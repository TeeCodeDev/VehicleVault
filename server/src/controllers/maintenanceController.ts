import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/database.js';
import { DATA_PATHS } from '../config/env.js';
import { MaintenanceService } from '../services/maintenanceService.js';
import { AiReceiptService } from '../services/aiReceiptService.js';

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
  garage_name: z.string().optional().nullable(),
  garage_address: z.string().optional().nullable(),
  line_items: z.union([z.string(), z.array(z.any())]).optional().nullable(),
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

  public static syncInvoiceToDocuments(
    vehicleId: string,
    userId: string | undefined,
    invoiceFileName: string,
    serviceItem: string,
    date: string,
    garageName?: string | null,
    notes?: string | null
  ): void {
    try {
      const srcPath = path.join(DATA_PATHS.invoices, invoiceFileName);
      if (!fs.existsSync(srcPath)) return;

      // Copy invoice into documents folder so /uploads/documents/:file works seamlessly
      const destPath = path.join(DATA_PATHS.documents, invoiceFileName);
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }

      const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date.split('-').reverse().join('-')
        : date;

      const docName = garageName
        ? `${serviceItem} — ${garageName} (${formattedDate})`
        : `${serviceItem} (${formattedDate})`;

      // Avoid duplicate entry in vehicle_documents; update existing if already synced
      const existingDoc = db.get<any>(
        'SELECT id FROM vehicle_documents WHERE vehicle_id = ? AND file_path = ?',
        [vehicleId, invoiceFileName]
      );
      if (existingDoc) {
        db.run(
          'UPDATE vehicle_documents SET name = ?, notes = COALESCE(?, notes) WHERE id = ?',
          [docName, notes || null, existingDoc.id]
        );
        return;
      }

      const veh = db.get<any>('SELECT user_id FROM vehicles WHERE id = ?', [vehicleId]);
      const effectiveUserId = userId || veh?.user_id;
      if (!effectiveUserId) return;

      const stat = fs.statSync(srcPath);
      const ext = path.extname(invoiceFileName).toLowerCase();
      const mimeType =
        ext === '.pdf'
          ? 'application/pdf'
          : ext === '.png'
            ? 'image/png'
            : ext === '.webp'
              ? 'image/webp'
              : 'image/jpeg';

      db.run(
        `INSERT INTO vehicle_documents (
          id, vehicle_id, user_id, name, category, file_path, file_size, mime_type, notes, created_at
        ) VALUES (?, ?, ?, ?, 'invoice', ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          vehicleId,
          effectiveUserId,
          docName,
          invoiceFileName,
          stat.size,
          mimeType,
          notes || null,
          new Date().toISOString(),
        ]
      );
    } catch (err) {
      console.warn('Failed to sync invoice to vehicle_documents:', err);
    }
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
    const lineItemsJson = data.line_items
      ? typeof data.line_items === 'string'
        ? data.line_items
        : JSON.stringify(data.line_items)
      : null;

    db.run(
      `INSERT INTO service_records (
        id, vehicle_id, category_id, maintenance_interval_id, service_item,
        date, odometer, performing_party, cost, parts_cost, labor_cost,
        garage_name, garage_address, line_items, notes, invoice_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        data.garage_name || null,
        data.garage_address || null,
        lineItemsJson,
        data.notes || null,
        data.invoice_path || null,
        new Date().toISOString(),
      ]
    );

    // Sync invoice into vehicle_documents so it also appears in "Documenten"
    if (data.invoice_path) {
      MaintenanceController.syncInvoiceToDocuments(
        data.vehicle_id,
        req.user?.userId,
        data.invoice_path,
        data.service_item,
        data.date,
        data.garage_name,
        data.notes
      );
    }

    // Update interval baseline if matching (and newer than or equal to existing service record)
    if (data.maintenance_interval_id) {
      const existingInterval = db.get<any>(
        'SELECT last_service_date, last_service_odometer FROM maintenance_intervals WHERE id = ?',
        [data.maintenance_interval_id]
      );
      const shouldUpdate =
        !existingInterval ||
        ((!existingInterval.last_service_date || data.date >= existingInterval.last_service_date) &&
          (!existingInterval.last_service_odometer || data.odometer >= existingInterval.last_service_odometer));
      if (shouldUpdate) {
        db.run(
          `UPDATE maintenance_intervals
           SET last_service_date = ?, last_service_odometer = ?
           WHERE id = ?`,
          [data.date, data.odometer, data.maintenance_interval_id]
        );
      }
    }

    res.status(201).json({ id, message: 'Service record logged' });
  }

  public static async updateRecord(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const existing = db.get<any>('SELECT * FROM service_records WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Service record not found' });
      return;
    }

    const parse = serviceRecordSchema.partial().safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0].message });
      return;
    }

    const data = parse.data;
    const partsCost = data.parts_cost !== undefined ? data.parts_cost : existing.parts_cost;
    const laborCost = data.labor_cost !== undefined ? data.labor_cost : existing.labor_cost;
    const effectiveCost =
      data.cost !== undefined
        ? data.cost
        : partsCost + laborCost > 0
          ? partsCost + laborCost
          : existing.cost;

    const lineItemsJson =
      data.line_items !== undefined
        ? data.line_items
          ? typeof data.line_items === 'string'
            ? data.line_items
            : JSON.stringify(data.line_items)
          : null
        : existing.line_items;

    const updatedServiceItem = data.service_item ?? existing.service_item;
    const updatedDate = data.date ?? existing.date;
    const updatedOdometer = data.odometer ?? existing.odometer;
    const updatedParty = data.performing_party ?? existing.performing_party;
    const updatedGarageName = data.garage_name !== undefined ? data.garage_name : existing.garage_name;
    const updatedGarageAddress = data.garage_address !== undefined ? data.garage_address : existing.garage_address;
    const updatedNotes = data.notes !== undefined ? data.notes : existing.notes;
    const updatedInvoicePath = data.invoice_path !== undefined ? data.invoice_path : existing.invoice_path;

    db.run(
      `UPDATE service_records SET
        service_item = ?,
        date = ?,
        odometer = ?,
        performing_party = ?,
        cost = ?,
        parts_cost = ?,
        labor_cost = ?,
        garage_name = ?,
        garage_address = ?,
        line_items = ?,
        notes = ?,
        invoice_path = ?
       WHERE id = ?`,
      [
        updatedServiceItem,
        updatedDate,
        updatedOdometer,
        updatedParty,
        effectiveCost,
        partsCost,
        laborCost,
        updatedGarageName || null,
        updatedGarageAddress || null,
        lineItemsJson,
        updatedNotes || null,
        updatedInvoicePath || null,
        id,
      ]
    );

    if (updatedInvoicePath) {
      MaintenanceController.syncInvoiceToDocuments(
        existing.vehicle_id,
        req.user?.userId,
        updatedInvoicePath,
        updatedServiceItem,
        updatedDate,
        updatedGarageName,
        updatedNotes
      );
    }

    res.json({ success: true, message: 'Service record updated' });
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

  /**
   * Upload and analyze/translate a maintenance invoice using AI Vision (Gemini / OpenAI).
   */
  public static async scanInvoice(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      res.status(400).json({ error: 'No invoice document or photo uploaded' });
      return;
    }

    const rawLang = (req.body?.lang || req.query?.lang || 'nl') as string;
    const targetLang: 'nl' | 'en' = rawLang === 'en' ? 'en' : 'nl';
    const aiConfigured = AiReceiptService.isConfigured();

    if (!aiConfigured) {
      res.json({
        fileName: req.file.filename,
        aiConfigured: false,
        extraction: null,
        warning:
          targetLang === 'nl'
            ? 'Geen AI API-sleutel geconfigureerd in Instellingen. Factuur is gekoppeld, vul de velden handmatig in.'
            : 'No AI API key configured in Settings. Invoice attached, please fill fields manually.',
      });
      return;
    }

    try {
      const extraction = await AiReceiptService.analyzeInvoice(req.file.path, targetLang);
      res.json({
        fileName: req.file.filename,
        aiConfigured: true,
        extraction,
      });
    } catch (err: any) {
      res.json({
        fileName: req.file.filename,
        aiConfigured: true,
        extraction: null,
        warning: err?.message || 'AI kon de factuur niet automatisch uitlezen.',
      });
    }
  }

  public static async attachInvoiceToRecord(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    if (!req.file) {
      res.status(400).json({ error: 'No invoice or service document uploaded' });
      return;
    }

    const record = db.get<any>('SELECT * FROM service_records WHERE id = ?', [id]);
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

    // Also sync to vehicle_documents ("Documenten")
    MaintenanceController.syncInvoiceToDocuments(
      record.vehicle_id,
      req.user?.userId,
      req.file.filename,
      record.service_item,
      record.date,
      record.garage_name,
      record.notes
    );

    res.json({ success: true, fileName: req.file.filename, message: 'Invoice attached successfully' });
  }

  public static async getFleetAlerts(req: Request, res: Response): Promise<void> {
    const alerts = MaintenanceService.getAllFleetMaintenanceAlerts(req.user?.userId || '');
    res.json({ alerts });
  }
}

