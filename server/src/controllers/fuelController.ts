import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/database.js';
import { OcrService } from '../services/ocrService.js';

const fuelSchema = z.object({
  vehicle_id: z.string().uuid(),
  date: z.string(),
  odometer: z.number().positive(),
  liters: z.number().positive(),
  price_per_liter: z.number().positive(),
  total_cost: z.number().positive().optional(),
  is_full_tank: z.boolean().default(true),
  missed_previous: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  receipt_path: z.string().optional().nullable(),
});

export class FuelController {
  public static async list(req: Request, res: Response): Promise<void> {
    const { vehicleId } = req.query;
    if (!vehicleId) {
      res.status(400).json({ error: 'vehicleId query parameter is required' });
      return;
    }

    // Verify ownership
    const vehicle = db.get('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [vehicleId, req.user?.userId]);
    if (!vehicle) {
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

    // Verify vehicle belongs to user
    const vehicle = db.get<{ initial_odometer: number }>(
      'SELECT initial_odometer FROM vehicles WHERE id = ? AND user_id = ?',
      [data.vehicle_id, req.user?.userId]
    );
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

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

    const calculatedCost = data.total_cost || Math.round(data.liters * data.price_per_liter * 100) / 100;
    const id = crypto.randomUUID();

    db.run(
      `INSERT INTO fuel_entries (
        id, vehicle_id, date, odometer, liters, price_per_liter, total_cost,
        is_full_tank, missed_previous, notes, receipt_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    const entry = db.get<any>(
      `SELECT f.id FROM fuel_entries f
       JOIN vehicles v ON v.id = f.vehicle_id
       WHERE f.id = ? AND v.user_id = ?`,
      [id, req.user?.userId]
    );

    if (!entry) {
      res.status(404).json({ error: 'Fuel entry not found' });
      return;
    }

    db.run('DELETE FROM fuel_entries WHERE id = ?', [id]);
    res.json({ success: true, message: 'Fuel entry deleted' });
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
}

