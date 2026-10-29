import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/database.js';
import { DATA_PATHS } from '../config/env.js';
import { OcrService } from '../services/ocrService.js';
import { StationService } from '../services/stationService.js';
import { FuelExportService } from '../services/fuelExportService.js';
import { getVehicleAccess } from '../utils/vehicleAccess.js';

const fuelSchema = z.object({
  vehicle_id: z.string().uuid(),
  date: z.string(),
  odometer: z.number().positive(),
  energy_type: z.enum(['fuel', 'electric']).default('fuel'),
  liters: z.number().nonnegative().default(0),
  price_per_liter: z.number().nonnegative().default(0),
  kwh: z.number().nonnegative().optional().nullable(),
  price_per_kwh: z.number().nonnegative().optional().nullable(),
  total_cost: z.number().positive().optional(),
  is_full_tank: z.boolean().default(true),
  missed_previous: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  receipt_path: z.string().optional().nullable(),
  station_name: z.string().optional().nullable(),
  station_address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export class FuelController {
  public static async list(req: Request, res: Response): Promise<void> {
    const vehicleId = (req.params.vehicleId || req.query.vehicleId) as string;
    if (!vehicleId) {
      res.status(400).json({ error: 'vehicleId is required' });
      return;
    }

    const access = getVehicleAccess(vehicleId, req.user?.userId);
    if (!access.hasAccess && req.user?.role !== 'admin') {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const entries = db.query(
      'SELECT * FROM fuel_entries WHERE vehicle_id = ? ORDER BY odometer DESC, date DESC',
      [vehicleId]
    );

    res.json({ entries });
  }

  public static async create(req: Request, res: Response): Promise<void> {
    const parse = fuelSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0].message });
      return;
    }

    const data = parse.data;
    const access = getVehicleAccess(data.vehicle_id, req.user?.userId);
    if (!access.hasAccess && req.user?.role !== 'admin') {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    const vehicle = access.vehicle;

    // Check odometer sanity against previous highest
    const lastFuel = db.get<{ max_odo: number | null }>(
      'SELECT MAX(odometer) as max_odo FROM fuel_entries WHERE vehicle_id = ?',
      [data.vehicle_id]
    );
    const highestOdo = Math.max(vehicle.initial_odometer || 0, lastFuel?.max_odo || 0);

    const warnings: string[] = [];
    if (data.odometer < highestOdo) {
      warnings.push(`Odometer (${data.odometer}) is lower than the previous highest recorded (${highestOdo} km).`);
    } else if (data.odometer - highestOdo > 2500) {
      warnings.push(`Large odometer delta (${data.odometer - highestOdo} km since last entry). Consider checking "Missed Previous Fill-up".`);
    }

    let calculatedCost = data.total_cost;
    if (!calculatedCost) {
      if (data.energy_type === 'electric') {
        calculatedCost = Math.round((data.kwh || 0) * (data.price_per_kwh || 0) * 100) / 100;
      } else {
        calculatedCost = Math.round(data.liters * data.price_per_liter * 100) / 100;
      }
    }
    const id = crypto.randomUUID();

    db.run(
      `INSERT INTO fuel_entries (
        id, vehicle_id, date, odometer, liters, price_per_liter, total_cost,
        is_full_tank, missed_previous, notes, receipt_path,
        station_name, station_address, latitude, longitude,
        energy_type, kwh, price_per_kwh, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.vehicle_id,
        data.date,
        data.odometer,
        data.liters,
        data.price_per_liter,
        calculatedCost,
        data.is_full_tank ? 1 : 0,
        data.missed_previous ? 1 : 0,
        data.notes || null,
        data.receipt_path || null,
        data.station_name || null,
        data.station_address || null,
        data.latitude !== undefined ? data.latitude : null,
        data.longitude !== undefined ? data.longitude : null,
        data.energy_type || 'fuel',
        data.kwh !== undefined ? data.kwh : null,
        data.price_per_kwh !== undefined ? data.price_per_kwh : null,
        new Date().toISOString(),
      ]
    );

    res.status(201).json({
      id,
      message: 'Fuel entry recorded',
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const isShared = req.user?.role === 'admin' || req.user?.role === 'driver';
    const entry = db.get<any>(
      `SELECT f.id FROM fuel_entries f
       JOIN vehicles v ON v.id = f.vehicle_id
       WHERE f.id = ? ${isShared ? '' : 'AND v.user_id = ?'}`,
      isShared ? [id] : [id, req.user?.userId]
    );

    if (!entry) {
      res.status(404).json({ error: 'Fuel entry not found' });
      return;
    }

    db.run('DELETE FROM fuel_entries WHERE id = ?', [id]);
    res.json({ success: true, message: 'Fuel entry deleted' });
  }

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const data = req.body;
    const isShared = req.user?.role === 'admin' || req.user?.role === 'driver';

    const existing = db.get<{ id: string; vehicle_id: string }>(
      `SELECT f.id, f.vehicle_id FROM fuel_entries f
       JOIN vehicles v ON v.id = f.vehicle_id
       WHERE f.id = ? ${isShared ? '' : 'AND v.user_id = ?'}`,
      isShared ? [id] : [id, req.user?.userId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Fuel entry not found' });
      return;
    }

    let calculatedCost = data.total_cost;
    if (!calculatedCost) {
      if (data.energy_type === 'electric') {
        calculatedCost = Math.round((data.kwh || 0) * (data.price_per_kwh || 0) * 100) / 100;
      } else {
        calculatedCost = Math.round(data.liters * data.price_per_liter * 100) / 100;
      }
    }

    db.run(
      `UPDATE fuel_entries SET
        date = ?,
        odometer = ?,
        liters = ?,
        price_per_liter = ?,
        total_cost = ?,
        is_full_tank = ?,
        missed_previous = ?,
        notes = ?,
        receipt_path = ?,
        station_name = ?,
        station_address = ?,
        latitude = ?,
        longitude = ?,
        energy_type = COALESCE(?, energy_type),
        kwh = ?,
        price_per_kwh = ?
       WHERE id = ?`,
      [
        data.date,
        data.odometer,
        data.liters,
        data.price_per_liter,
        calculatedCost,
        data.is_full_tank ? 1 : 0,
        data.missed_previous ? 1 : 0,
        data.notes !== undefined ? data.notes : null,
        data.receipt_path !== undefined ? data.receipt_path : null,
        data.station_name !== undefined ? data.station_name : null,
        data.station_address !== undefined ? data.station_address : null,
        data.latitude !== undefined ? data.latitude : null,
        data.longitude !== undefined ? data.longitude : null,
        data.energy_type || null,
        data.kwh !== undefined ? data.kwh : null,
        data.price_per_kwh !== undefined ? data.price_per_kwh : null,
        id,
      ]
    );

    res.json({ success: true, message: 'Fuel entry updated' });
  }

  public static async uploadReceiptFile(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      res.status(400).json({ error: 'No receipt or invoice file uploaded' });
      return;
    }
    res.json({ fileName: req.file.filename });
  }

  public static async ocrReceipt(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      res.status(400).json({ error: 'No receipt image uploaded' });
      return;
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;

    try {
      const result = await OcrService.processReceipt(filePath);
      res.json({
        receiptPath: fileName,
        extracted: result,
      });
    } catch (err: any) {
      res.status(500).json({ error: `OCR error: ${err?.message || 'Processing failed'}` });
    }
  }

  public static async rescanReceipt(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { receiptPath: bodyReceiptPath } = req.body || {};

      let receiptFileName = bodyReceiptPath;
      if (!receiptFileName && id) {
        const entry = db.get<any>('SELECT receipt_path, vehicle_id FROM fuel_entries WHERE id = ?', [id]);
        if (!entry) {
          res.status(404).json({ error: 'Tankbeurt niet gevonden' });
          return;
        }
        receiptFileName = entry.receipt_path;
      }

      if (!receiptFileName || typeof receiptFileName !== 'string') {
        res.status(400).json({ error: 'Geen bonbestand gekoppeld aan deze tankbeurt' });
        return;
      }

      const safeFileName = path.basename(receiptFileName.trim());
      const fullPath = path.join(DATA_PATHS.receipts, safeFileName);

      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'Het tankbonbestand kon niet worden gevonden op de server' });
        return;
      }

      const result = await OcrService.processReceipt(fullPath);
      res.json({
        receiptPath: safeFileName,
        extracted: result,
      });
    } catch (err: any) {
      console.error('Rescan receipt error:', err);
      res.status(500).json({ error: `OCR / AI scan fout: ${err?.message || 'Uitlezen mislukt'}` });
    }
  }

  public static async getNearbyStations(req: Request, res: Response): Promise<void> {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const radius = parseFloat(req.query.radius as string) || 7;

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({ error: 'Geldige lat en lon parameters zijn verplicht.' });
      return;
    }

    try {
      const stations = await StationService.findNearbyStations(lat, lon, radius);
      res.json({ stations });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Fout bij ophalen van tankstations in de buurt.' });
    }
  }

  public static async searchStations(req: Request, res: Response): Promise<void> {
    const q = ((req.query.q as string) || '').trim();
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;

    if (!q || q.length < 2) {
      res.json({ stations: [] });
      return;
    }

    try {
      const stations = await StationService.searchStations(q, lat, lon);
      res.json({ stations });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Fout bij zoeken naar tankstations.' });
    }
  }

  public static async exportExcel(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId } = req.query;
      if (!vehicleId || typeof vehicleId !== 'string') {
        res.status(400).json({ error: 'vehicleId is required' });
        return;
      }

      const access = getVehicleAccess(vehicleId, req.user?.userId);
      if (!access.hasAccess && req.user?.role !== 'admin') {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      const vehicle = access.vehicle;

      const entries = db.query<any>(
        'SELECT * FROM fuel_entries WHERE vehicle_id = ? ORDER BY odometer ASC',
        [vehicleId]
      );

      const buffer = await FuelExportService.generateExcel(vehicle, entries);
      const safePlate = (vehicle.license_plate || 'tankbeurten').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Tankhistorie_${safePlate}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to export fuel excel' });
    }
  }

  public static async exportCsv(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId } = req.query;
      if (!vehicleId || typeof vehicleId !== 'string') {
        res.status(400).json({ error: 'vehicleId is required' });
        return;
      }

      const access = getVehicleAccess(vehicleId, req.user?.userId);
      if (!access.hasAccess && req.user?.role !== 'admin') {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      const vehicle = access.vehicle;

      const entries = db.query<any>(
        'SELECT * FROM fuel_entries WHERE vehicle_id = ? ORDER BY odometer ASC',
        [vehicleId]
      );

      const buffer = FuelExportService.generateCsv(vehicle, entries);
      const safePlate = (vehicle.license_plate || 'tankbeurten').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Tankhistorie_${safePlate}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to export fuel csv' });
    }
  }
}
