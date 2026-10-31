import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { TcoService } from '../services/tcoService.js';
import { PdfService } from '../services/pdfService.js';
import { getVehicleAccess } from '../utils/vehicleAccess.js';

export class AnalyticsController {
  public static async getTco(req: Request, res: Response): Promise<void> {
    const { vehicleId } = req.params;
    const { startDate, endDate, minOdometer, maxOdometer, includePurchasePrice, includeFixedExpenses } = req.query;

    const access = getVehicleAccess(vehicleId, req.user?.userId);
    if (!access.hasAccess && req.user?.role !== 'admin') {
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
        includeFixedExpenses:
          includeFixedExpenses !== undefined
            ? includeFixedExpenses === 'true' || includeFixedExpenses === '1'
            : true,
      });

      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error calculating TCO' });
    }
  }

  public static async getFleetTco(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const role = req.user?.role;

      let vehicles: any[] = [];
      if (role === 'admin') {
        vehicles = db.query('SELECT * FROM vehicles WHERE status = "active"');
      } else {
        vehicles = db.query(`
          SELECT v.* FROM vehicles v
          LEFT JOIN vehicle_shares vs ON vs.vehicle_id = v.id AND vs.user_id = ?
          WHERE v.status = "active" AND (v.user_id = ? OR vs.id IS NOT NULL)
        `, [userId, userId]);
      }

      const { startDate, endDate, includeFixedExpenses, includePurchasePrice } = req.query;

      const fleetSummaries: any[] = [];
      let fleetTotalCost = 0;
      let fleetFuelTotal = 0;
      let fleetServiceTotal = 0;
      let fleetFixedExpensesTotal = 0;
      let fleetTotalDistanceKm = 0;

      const combinedMonthly: Record<string, { month: string; fuel: number; regularMaintenance: number; unscheduledRepairs: number; fixedExpenses: number; total: number }> = {};

      for (const v of vehicles) {
        try {
          const s = TcoService.calculateTco({
            vehicleId: v.id,
            startDate: startDate ? String(startDate) : undefined,
            endDate: endDate ? String(endDate) : undefined,
            includePurchasePrice: includePurchasePrice === 'true',
            includeFixedExpenses: includeFixedExpenses !== 'false',
          });

          fleetSummaries.push({
            id: v.id,
            name: v.name,
            license_plate: v.license_plate,
            type: v.type,
            totalCost: s.totalCost,
            fuelTotal: s.fuelTotal,
            serviceTotal: s.serviceTotal,
            fixedExpensesTotal: s.fixedExpensesTotal,
            costPerKm: s.costPerKm,
            totalDistanceKm: s.totalDistanceKm,
            avgLPer100Km: s.avgLPer100Km,
          });

          fleetTotalCost += s.totalCost;
          fleetFuelTotal += s.fuelTotal;
          fleetServiceTotal += s.serviceTotal;
          fleetFixedExpensesTotal += s.fixedExpensesTotal;
          fleetTotalDistanceKm += s.totalDistanceKm;

          for (const mb of s.monthlyBreakdown) {
            if (!combinedMonthly[mb.month]) {
              combinedMonthly[mb.month] = {
                month: mb.month,
                fuel: 0,
                regularMaintenance: 0,
                unscheduledRepairs: 0,
                fixedExpenses: 0,
                total: 0,
              };
            }
            combinedMonthly[mb.month].fuel += mb.fuel;
            combinedMonthly[mb.month].regularMaintenance += mb.regularMaintenance;
            combinedMonthly[mb.month].unscheduledRepairs += mb.unscheduledRepairs;
            combinedMonthly[mb.month].fixedExpenses += mb.fixedExpenses;
            combinedMonthly[mb.month].total += mb.total;
          }
        } catch {}
      }

      const monthlyBreakdown = Object.values(combinedMonthly).sort((a, b) => a.month.localeCompare(b.month));
      const fleetCostPerKm = fleetTotalDistanceKm > 0 ? fleetTotalCost / fleetTotalDistanceKm : 0;

      res.json({
        fleetTotalCost,
        fleetFuelTotal,
        fleetServiceTotal,
        fleetFixedExpensesTotal,
        fleetTotalDistanceKm,
        fleetCostPerKm,
        vehicleCount: vehicles.length,
        vehicles: fleetSummaries,
        monthlyBreakdown,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error calculating Fleet TCO' });
    }
  }

  public static async exportPdf(req: Request, res: Response): Promise<void> {
    const { vehicleId, includeTires, includeFuel, includeReceipts, startDate, endDate } = req.body;

    if (!vehicleId) {
      res.status(400).json({ error: 'vehicleId is required' });
      return;
    }

    const access = getVehicleAccess(vehicleId, req.user?.userId);
    if (!access.hasAccess && req.user?.role !== 'admin') {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const vehicle = access.vehicle || db.get<{ id: string; name: string }>('SELECT id, name FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    try {
      const pdfBuffer = await PdfService.generateDossier({
        vehicleId,
        includeTires: includeTires !== false,
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
