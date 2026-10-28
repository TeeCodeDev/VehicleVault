import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { ImportService } from '../services/importService.js';

export class ImportController {
  public static async preview(req: Request, res: Response): Promise<void> {
    const { vehicleId, forcedFormat, mapping } = req.body;
    let csvContent = '';

    if (req.file) {
      csvContent = req.file.buffer.toString('utf-8');
    } else if (req.body.csvText) {
      csvContent = req.body.csvText;
    }

    if (!csvContent || !vehicleId) {
      res.status(400).json({ error: 'vehicleId and CSV content are required' });
      return;
    }

    const vehicle = db.get('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [vehicleId, req.user?.userId]);
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    try {
      const parsedMapping = mapping && typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
      const preview = ImportService.previewImport(csvContent, vehicleId, forcedFormat, parsedMapping);
      res.json(preview);
    } catch (err: any) {
      res.status(400).json({ error: `Failed to parse CSV: ${err?.message}` });
    }
  }

  public static async execute(req: Request, res: Response): Promise<void> {
    const { vehicleId, records } = req.body;

    if (!vehicleId || !Array.isArray(records)) {
      res.status(400).json({ error: 'vehicleId and records array are required' });
      return;
    }

    const vehicle = db.get('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [vehicleId, req.user?.userId]);
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    try {
      const result = ImportService.executeImport(vehicleId, records);
      res.json({
        success: true,
        importedCount: result.importedCount,
        message: `Successfully imported ${result.importedCount} records into VehicleVault.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: `Import execution failed: ${err?.message}` });
    }
  }
}

