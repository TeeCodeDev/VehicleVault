import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/database.js';

export class TireController {
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId } = req.query;
      if (!vehicleId || typeof vehicleId !== 'string') {
        res.status(400).json({ error: 'vehicleId query parameter is required' });
        return;
      }

      const tireSets = db.query(
        "SELECT * FROM tire_sets WHERE vehicle_id = ? ORDER BY CASE WHEN status = 'mounted' THEN 0 ELSE 1 END, created_at DESC",
        [vehicleId]
      );

      // Get vehicle current odometer to compute live mileage on mounted tire sets
      const vehOdoRow = db.get<any>(
        `SELECT 
          MAX(
            COALESCE((SELECT MAX(odometer) FROM fuel_entries WHERE vehicle_id = ?), 0),
            COALESCE((SELECT MAX(odometer) FROM service_records WHERE vehicle_id = ?), 0),
            COALESCE((SELECT MAX(odometer) FROM odometer_logs WHERE vehicle_id = ?), 0),
            (SELECT initial_odometer FROM vehicles WHERE id = ?)
          ) as current_odometer`,
        [vehicleId, vehicleId, vehicleId, vehicleId]
      );
      const vehicleCurrentOdo = vehOdoRow?.current_odometer || 0;

      // Evaluate tread depths for alerts & compute dynamic live mileage
      const enrichedSets = tireSets.map((set) => {
        let currentKm = set.total_km || 0;
        if (set.status === 'mounted' && set.mounted_odometer !== null && set.mounted_odometer !== undefined) {
          const delta = Math.max(0, vehicleCurrentOdo - set.mounted_odometer);
          currentKm += delta;
        }

        const depths = [set.tread_depth_fl, set.tread_depth_fr, set.tread_depth_rl, set.tread_depth_rr].filter(
          (d) => d !== null && d !== undefined
        );
        const minDepth = depths.length > 0 ? Math.min(...depths) : null;
        let treadStatus: 'ok' | 'warning' | 'critical' | 'unknown' = 'unknown';

        if (minDepth !== null) {
          if (minDepth < 1.6) {
            treadStatus = 'critical'; // Legal minimum limit / APK rejection
          } else if (set.season === 'winter' && minDepth < 4.0) {
            treadStatus = 'warning'; // Winter tire optimal limit
          } else if (minDepth < 2.5) {
            treadStatus = 'warning'; // Summer tire replacement warning
          } else {
            treadStatus = 'ok';
          }
        }

        return {
          ...set,
          current_km: currentKm,
          minDepth,
          treadStatus,
        };
      });

      res.json({ tireSets: enrichedSets });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list tire sets' });
    }
  }

  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const {
        vehicleId,
        name,
        season = 'summer',
        brandModel = '',
        brand = '',
        model = '',
        tireSize = '',
        rimSize = '',
        speedIndex = '',
        dotCode = '',
        storageLocation = '',
        status = 'stored',
        mountedOdometer = null,
        mountedDate = null,
        totalKm = 0,
        treadDepthFl = null,
        treadDepthFr = null,
        treadDepthRl = null,
        treadDepthRr = null,
        lastMeasuredDate = null,
        notes = '',
      } = req.body;

      if (!vehicleId || !name) {
        res.status(400).json({ error: 'vehicleId and name are required' });
        return;
      }

      // If status is 'mounted', ensure no other tire set is already mounted
      if (status === 'mounted') {
        db.run("UPDATE tire_sets SET status = 'stored' WHERE vehicle_id = ? AND status = 'mounted'", [vehicleId]);
      }

      // If mounted and mountedOdometer is not explicitly provided, default to current vehicle odometer
      let finalMountedOdo = mountedOdometer !== null && mountedOdometer !== undefined && mountedOdometer !== '' ? Number(mountedOdometer) : null;
      if (status === 'mounted' && finalMountedOdo === null) {
        const vehOdoRow = db.get<any>(
          `SELECT 
            MAX(
              COALESCE((SELECT MAX(odometer) FROM fuel_entries WHERE vehicle_id = ?), 0),
              COALESCE((SELECT MAX(odometer) FROM service_records WHERE vehicle_id = ?), 0),
              COALESCE((SELECT MAX(odometer) FROM odometer_logs WHERE vehicle_id = ?), 0),
              (SELECT initial_odometer FROM vehicles WHERE id = ?)
            ) as current_odometer`,
          [vehicleId, vehicleId, vehicleId, vehicleId]
        );
        finalMountedOdo = vehOdoRow?.current_odometer || null;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const trimmedBrand = brand ? brand.trim() : null;
      const trimmedModel = model ? model.trim() : null;
      const computedBrandModel = trimmedBrand
        ? `${trimmedBrand}${trimmedModel ? ` ${trimmedModel}` : ''}`
        : (brandModel?.trim() || null);

      db.run(
        `INSERT INTO tire_sets (
          id, vehicle_id, name, season, brand_model, brand, model, tire_size, rim_size, speed_index,
          dot_code, storage_location,
          status, mounted_odometer, mounted_date, total_km,
          tread_depth_fl, tread_depth_fr, tread_depth_rl, tread_depth_rr,
          last_measured_date, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          vehicleId,
          name.trim(),
          season,
          computedBrandModel,
          trimmedBrand,
          trimmedModel,
          tireSize?.trim() || null,
          rimSize?.trim() || null,
          speedIndex?.trim() || null,
          dotCode?.trim() || null,
          storageLocation?.trim() || null,
          status,
          finalMountedOdo,
          mountedDate || (status === 'mounted' ? now.split('T')[0] : null),
          Number(totalKm) || 0,
          treadDepthFl !== null && treadDepthFl !== undefined && treadDepthFl !== '' ? Number(treadDepthFl) : null,
          treadDepthFr !== null && treadDepthFr !== undefined && treadDepthFr !== '' ? Number(treadDepthFr) : null,
          treadDepthRl !== null && treadDepthRl !== undefined && treadDepthRl !== '' ? Number(treadDepthRl) : null,
          treadDepthRr !== null && treadDepthRr !== undefined && treadDepthRr !== '' ? Number(treadDepthRr) : null,
          lastMeasuredDate || null,
          notes?.trim() || null,
          now,
        ]
      );

      const created = db.get('SELECT * FROM tire_sets WHERE id = ?', [id]);
      res.status(201).json({ tireSet: created });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create tire set' });
    }
  }

  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        name,
        season,
        brandModel,
        brand,
        model,
        tireSize,
        rimSize,
        speedIndex,
        dotCode,
        storageLocation,
        status,
        mountedOdometer,
        mountedDate,
        totalKm,
        treadDepthFl,
        treadDepthFr,
        treadDepthRl,
        treadDepthRr,
        lastMeasuredDate,
        notes,
      } = req.body;

      const existing = db.get<any>('SELECT * FROM tire_sets WHERE id = ?', [id]);
      if (!existing) {
        res.status(404).json({ error: 'Tire set not found' });
        return;
      }

      if (status === 'mounted' && existing.status !== 'mounted') {
        db.run("UPDATE tire_sets SET status = 'stored' WHERE vehicle_id = ? AND status = 'mounted'", [existing.vehicle_id]);
      }

      const updatedBrand = brand !== undefined ? (brand?.trim() || null) : existing.brand;
      const updatedModel = model !== undefined ? (model?.trim() || null) : existing.model;
      let updatedBrandModel = existing.brand_model;
      if (brand !== undefined || model !== undefined) {
        updatedBrandModel = updatedBrand ? `${updatedBrand}${updatedModel ? ` ${updatedModel}` : ''}` : null;
      } else if (brandModel !== undefined) {
        updatedBrandModel = brandModel?.trim() || null;
      }

      const updatedTotalKm = totalKm !== undefined && totalKm !== null && totalKm !== '' ? Number(totalKm) : existing.total_km;
      const updatedMountedOdo = mountedOdometer !== undefined ? (mountedOdometer !== null && mountedOdometer !== '' ? Number(mountedOdometer) : null) : existing.mounted_odometer;
      const updatedMountedDate = mountedDate !== undefined ? (mountedDate || null) : existing.mounted_date;

      db.run(
        `UPDATE tire_sets SET
          name = COALESCE(?, name),
          season = COALESCE(?, season),
          brand_model = ?,
          brand = ?,
          model = ?,
          tire_size = COALESCE(?, tire_size),
          rim_size = COALESCE(?, rim_size),
          speed_index = COALESCE(?, speed_index),
          dot_code = COALESCE(?, dot_code),
          storage_location = COALESCE(?, storage_location),
          status = COALESCE(?, status),
          mounted_odometer = ?,
          mounted_date = ?,
          total_km = ?,
          tread_depth_fl = ?,
          tread_depth_fr = ?,
          tread_depth_rl = ?,
          tread_depth_rr = ?,
          last_measured_date = COALESCE(?, last_measured_date),
          notes = COALESCE(?, notes)
        WHERE id = ?`,
        [
          name !== undefined ? name.trim() : null,
          season ?? null,
          updatedBrandModel,
          updatedBrand,
          updatedModel,
          tireSize !== undefined ? tireSize.trim() : null,
          rimSize !== undefined ? rimSize.trim() : null,
          speedIndex !== undefined ? speedIndex.trim() : null,
          dotCode !== undefined ? dotCode.trim() : null,
          storageLocation !== undefined ? storageLocation.trim() : null,
          status ?? null,
          updatedMountedOdo,
          updatedMountedDate,
          updatedTotalKm,
          treadDepthFl !== undefined ? (treadDepthFl !== '' && treadDepthFl !== null ? Number(treadDepthFl) : null) : existing.tread_depth_fl,
          treadDepthFr !== undefined ? (treadDepthFr !== '' && treadDepthFr !== null ? Number(treadDepthFr) : null) : existing.tread_depth_fr,
          treadDepthRl !== undefined ? (treadDepthRl !== '' && treadDepthRl !== null ? Number(treadDepthRl) : null) : existing.tread_depth_rl,
          treadDepthRr !== undefined ? (treadDepthRr !== '' && treadDepthRr !== null ? Number(treadDepthRr) : null) : existing.tread_depth_rr,
          lastMeasuredDate ?? null,
          notes !== undefined ? notes.trim() : null,
          id,
        ]
      );

      const updated = db.get('SELECT * FROM tire_sets WHERE id = ?', [id]);
      res.json({ tireSet: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update tire set' });
    }
  }

  public static async swap(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { currentOdometer, date = new Date().toISOString().split('T')[0] } = req.body;

      if (currentOdometer === undefined || currentOdometer === null) {
        res.status(400).json({ error: 'currentOdometer is required to register a tire swap' });
        return;
      }

      const odo = Number(currentOdometer);
      const targetSet = db.get<{ id: string; vehicle_id: string; total_km: number }>('SELECT * FROM tire_sets WHERE id = ?', [id]);
      if (!targetSet) {
        res.status(404).json({ error: 'Target tire set not found' });
        return;
      }

      // Find currently mounted set (if any)
      const currentMounted = db.get<{ id: string; mounted_odometer: number; total_km: number }>(
        "SELECT * FROM tire_sets WHERE vehicle_id = ? AND status = 'mounted'",
        [targetSet.vehicle_id]
      );

      if (currentMounted && currentMounted.id !== targetSet.id) {
        const deltaKm = currentMounted.mounted_odometer ? Math.max(0, odo - currentMounted.mounted_odometer) : 0;
        const newTotal = (currentMounted.total_km || 0) + deltaKm;
        db.run("UPDATE tire_sets SET status = 'stored', total_km = ? WHERE id = ?", [newTotal, currentMounted.id]);
      }

      // Mark target set as mounted
      db.run(
        "UPDATE tire_sets SET status = 'mounted', mounted_odometer = ?, mounted_date = ? WHERE id = ?",
        [odo, date, id]
      );

      const updated = db.get('SELECT * FROM tire_sets WHERE id = ?', [id]);
      res.json({ message: 'Tire set swapped successfully', tireSet: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to swap tire sets' });
    }
  }

  public static async updateTread(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { fl, fr, rl, rr, date = new Date().toISOString().split('T')[0] } = req.body;

      const existing = db.get('SELECT * FROM tire_sets WHERE id = ?', [id]);
      if (!existing) {
        res.status(404).json({ error: 'Tire set not found' });
        return;
      }

      db.run(
        `UPDATE tire_sets SET
          tread_depth_fl = ?,
          tread_depth_fr = ?,
          tread_depth_rl = ?,
          tread_depth_rr = ?,
          last_measured_date = ?
        WHERE id = ?`,
        [
          fl !== undefined && fl !== '' && fl !== null ? Number(fl) : null,
          fr !== undefined && fr !== '' && fr !== null ? Number(fr) : null,
          rl !== undefined && rl !== '' && rl !== null ? Number(rl) : null,
          rr !== undefined && rr !== '' && rr !== null ? Number(rr) : null,
          date,
          id,
        ]
      );

      const updated = db.get('SELECT * FROM tire_sets WHERE id = ?', [id]);
      res.json({ tireSet: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update tread depth' });
    }
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = db.run('DELETE FROM tire_sets WHERE id = ?', [id]);
      if (result.changes === 0) {
        res.status(404).json({ error: 'Tire set not found' });
        return;
      }
      res.json({ message: 'Tire set deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete tire set' });
    }
  }
}
