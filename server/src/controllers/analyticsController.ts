import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { TcoService } from '../services/tcoService.js';
import { PdfService } from '../services/pdfService.js';

export class AnalyticsController {
  public static async getTco(req: Request, res: Response): Promise<void> {
    const { vehicleId } = req.params;
    const { startDate, endDate, minOdometer, maxOdometer, includePurchasePrice, includeFixedExpenses } = req.query;

    const vehicle = db.get('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [vehicleId, req.user?.userId]);
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    try {
      const summary = TcoService.calculateTco({
        vehicleId,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        minOdometer: minOdometer ? parseFloat(String(minOdometer)) : undefined,
        maxOdometer: maxOdometer ? parseFloat(String(maxOdometer)) : undefined,
        includePurchasePrice: includePurchasePrice === 'true' || includePurchasePrice === '1',
        includeFixedExpenses: includeFixedExpenses !== undefined ? (includeFixedExpenses === 'true' || includeFixedExpenses === '1') : true,
      });

      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error calculating TCO' });
    }
  }

  public static async exportPdf(req: Request, res: Response): Promise<void> {
    const { vehicleId, includeFuel, includeReceipts, startDate, endDate } = req.body;

    if (!vehicleId) {
      res.status(400).json({ error: 'vehicleId is required' });
      return;
    }

    const vehicle = db.get<{ id: string; name: string }>(
      'SELECT id, name FROM vehicles WHERE id = ? AND user_id = ?',
      [vehicleId, req.user?.userId]
    );
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    try {
      const pdfBuffer = await PdfService.generateDossier({
        vehicleId,
        includeFuel: includeFuel !== false,
        includeReceipts: includeReceipts === true,
        startDate,
        endDate,
      });

      const safeName = vehicle.name.replace(/[^a-zA-Z0-9]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Service_Booklet_${safeName}.pdf"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ error: `Failed to generate PDF: ${err?.message}` });
    }
  }
}

