import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { HaService } from '../services/haService.js';
import { RdwService } from '../services/rdwService.js';
import { MaintenanceService } from '../services/maintenanceService.js';

export class HaController {
  public static getSensors(req: Request, res: Response): void {
    try {
      const payload = HaService.getSensorsPayload(req.user?.userId);
      res.json(payload);
    } catch (err: any) {
      console.error('Home Assistant sensors endpoint error:', err);
      res.status(500).json({ error: 'Failed to retrieve Home Assistant sensors data' });
    }
  }

  public static async updateOdometer(req: Request, res: Response): Promise<void> {
    try {
      const { vehicle_id, license_plate, odometer, source } = req.body;
      const userId = req.user?.userId;

      const odoNum = parseFloat(odometer);
      if (isNaN(odoNum) || odoNum < 0) {
        res.status(400).json({ error: 'A valid positive odometer number is required' });
        return;
      }

      let vehicle: any = null;
      if (vehicle_id) {
        vehicle = userId
          ? db.get<any>(
              `SELECT * FROM vehicles
               WHERE id = ? AND (user_id = ? OR id IN (SELECT vehicle_id FROM vehicle_shares WHERE shared_with_user_id = ? AND permission = 'write'))`,
              [vehicle_id, userId, userId]
            )
          : db.get<any>('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
      } else if (license_plate) {
        const clean = RdwService.normalizePlate(license_plate);
        vehicle = userId
          ? db.get<any>(
              `SELECT * FROM vehicles
               WHERE UPPER(REPLACE(REPLACE(license_plate, "-", ""), " ", "")) = ?
                 AND (user_id = ? OR id IN (SELECT vehicle_id FROM vehicle_shares WHERE shared_with_user_id = ? AND permission = 'write'))`,
              [clean, userId, userId]
            )
          : db.get<any>(
              'SELECT * FROM vehicles WHERE UPPER(REPLACE(REPLACE(license_plate, "-", ""), " ", "")) = ?',
              [clean]
            );
      } else {
        // Fallback: If only 1 active vehicle exists for this user, use it
        const all = userId
          ? db.query<any>(
              `SELECT * FROM vehicles
               WHERE status = 'active' AND (user_id = ? OR id IN (SELECT vehicle_id FROM vehicle_shares WHERE shared_with_user_id = ? AND permission = 'write'))
               LIMIT 2`,
              [userId, userId]
            )
          : db.query<any>("SELECT * FROM vehicles WHERE status = 'active' LIMIT 2");
        if (all.length === 1) {
          vehicle = all[0];
        }
      }

      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found. Provide a valid vehicle_id or license_plate.' });
        return;
      }

      const logId = crypto.randomUUID();
      const now = new Date().toISOString();
      const today = now.slice(0, 10);

      db.run(
        `INSERT INTO odometer_logs (id, vehicle_id, odometer, source, date, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, vehicle.id, odoNum, source || 'home_assistant', today, now]
      );

      // Check if this new odometer reading triggers any dual-trigger maintenance alerts
      const alerts = MaintenanceService.getVehicleMaintenanceStatus(vehicle.id);

      res.status(200).json({
        success: true,
        message: 'Odometer updated successfully',
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.name,
        odometer: odoNum,
        maintenance_alerts: alerts,
      });
    } catch (err: any) {
      console.error('Home Assistant odometer update error:', err);
      res.status(500).json({ error: 'Failed to update vehicle odometer' });
    }
  }
}
