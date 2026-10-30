import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/database.js';
import { DATA_PATHS } from '../config/env.js';
import { MaintenanceService } from '../services/maintenanceService.js';

const intervalSchema = z.object({
  vehicle_id: z.string().uuid(),
  category_id: z.string().uuid(),
  custom_name: z.string().optional().nullable(),
  interval_km: z.number().positive().optional().nullable(),
  interval_months: z.number().int().positive().optional().nullable(),
  last_service_date: z.string().optional().nullable(),
  last_service_odometer: z.number().nonnegative().optional().nullable(),
});

const serviceRecordSchema = z.object({
  vehicle_id: z.string().uuid(),
  category_id: z.string().uuid().optional().nullable(),
  maintenance_interval_id: z.string().uuid().optional().nullable(),
  service_item: z.string().min(1),
  date: z.string(),
  odometer: z.number().nonnegative(),
  performing_party: z.enum(['self', 'garage']).default('self'),
  cost: z.number().nonnegative().default(0),
  parts_cost: z.number().nonnegative().optional().default(0),
  labor_cost: z.number().nonnegative().optional().default(0),
  notes: z.string().optional().nullable(),
  invoice_path: z.string().optional().nullable(),
});

export class MaintenanceController {
  public static async listCategories(_req: Request, res: Response): Promise<void> {
    const categories = db.query('SELECT * FROM service_categories ORDER BY is_preset DESC, name ASC');
    res.json({ categories });
  }

  public static async listIntervals(req: Request, res: Response): Promise<void> {
    const { vehicleId } = req.params;
    const vehicle = db.get('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [vehicleId, req.user?.userId]);
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const intervals = MaintenanceService.getVehicleMaintenanceStatus(vehicleId);
    res.json({ intervals });
  }

  public static async createInterval(req: Request, res: Response): Promise<void> {
    const parse = intervalSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0].message });
      return;
    }

    const data = parse.data;
    const vehicle = db.get('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [data.vehicle_id, req.user?.userId]);
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO maintenance_intervals (
        id, vehicle_id, category_id, custom_name, interval_km, interval_months,
        last_service_date, last_service_odometer, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.vehicle_id,
        data.category_id,
        data.custom_name || null,
        data.interval_km || null,
        data.interval_months || null,
        data.last_service_date || null,
        data.last_service_odometer || null,
        new Date().toISOString(),
      ]
    );

    res.status(201).json({ id, message: 'Maintenance interval created' });
  }

  public static async updateInterval(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const parse = intervalSchema.partial().safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0].message });
      return;
    }

    const data = parse.data;
    db.run(
      `UPDATE maintenance_intervals SET
        custom_name = COALESCE(?, custom_name),
        interval_km = COALESCE(?, interval_km),
        interval_months = COALESCE(?, interval_months),
        last_service_date = COALESCE(?, last_service_date),
        last_service_odometer = COALESCE(?, last_service_odometer)
       WHERE id = ?`,
      [data.custom_name, data.interval_km, data.interval_months, data.last_service_date, data.last_service_odometer, id]
    );

    res.json({ success: true, message: 'Interval updated' });
  }

  public static async deleteInterval(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    db.run('DELETE FROM maintenance_intervals WHERE id = ?', [id]);
    res.json({ success: true, message: 'Interval deleted' });
  }

  public static async listRecords(req: Request, res: Response): Promise<void> {
    const { vehicleId } = req.params;
    const records = db.query(
      `SELECT s.*, c.name as category_name
       FROM service_records s
       LEFT JOIN service_categories c ON c.id = s.category_id
       WHERE s.vehicle_id = ?
       ORDER BY s.date DESC, s.odometer DESC`,
      [vehicleId]
    );
    res.json({ records });
  }

  public static async createRecord(req: Request, res: Response): Promise<void> {
    const parse = serviceRecordSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0].message });
      return;
    }

    const data = parse.data;
    const id = crypto.randomUUID();
    const partsCost = data.parts_cost || 0;
    const laborCost = data.labor_cost || 0;
    const effectiveCost = (partsCost + laborCost > 0) ? (partsCost + laborCost) : data.cost;

    db.run(
      `INSERT INTO service_records (
        id, vehicle_id, category_id, maintenance_interval_id, service_item,
        date, odometer, performing_party, cost, parts_cost, labor_cost, notes, invoice_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.vehicle_id,
        data.category_id || null,
        data.maintenance_interval_id || null,
        data.service_item,
        data.date,
        data.odometer,
        data.performing_party,
        effectiveCost,
        partsCost,
        laborCost,
        data.notes || null,
        data.invoice_path || null,
        new Date().toISOString(),
      ]
    );

    // Update interval baseline if matching
    if (data.maintenance_interval_id) {
      db.run(
        `UPDATE maintenance_intervals
         SET last_service_date = ?, last_service_odometer = ?
         WHERE id = ?`,
        [data.date, data.odometer, data.maintenance_interval_id]
      );
    }

    res.status(201).json({ id, message: 'Service record logged' });
  }

  public static async deleteRecord(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    db.run('DELETE FROM service_records WHERE id = ?', [id]);
    res.json({ success: true, message: 'Service record deleted' });
  }

  public static async uploadInvoiceFile(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      res.status(400).json({ error: 'No invoice or service document uploaded' });
      return;
    }
    res.json({ fileName: req.file.filename });
  }

  public static async attachInvoiceToRecord(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!req.file) {
      res.status(400).json({ error: 'No invoice or service document uploaded' });
      return;
    }

    const record = db.get<any>('SELECT id, invoice_path FROM service_records WHERE id = ?', [id]);
    if (!record) {
      fs.unlink(req.file.path, () => {});
      res.status(404).json({ error: 'Service record not found' });
      return;
    }

    // Clean up previous invoice file if exists
    if (record.invoice_path) {
      const oldPath = path.join(DATA_PATHS.invoices, record.invoice_path);
      if (fs.existsSync(oldPath)) {
        fs.unlink(oldPath, () => {});
      }
    }

    db.run('UPDATE service_records SET invoice_path = ? WHERE id = ?', [req.file.filename, id]);
    res.json({ success: true, fileName: req.file.filename, message: 'Invoice attached successfully' });
  }

  public static async getFleetAlerts(req: Request, res: Response): Promise<void> {
    const alerts = MaintenanceService.getAllFleetMaintenanceAlerts(req.user?.userId || '');
    res.json({ alerts });
  }
}

