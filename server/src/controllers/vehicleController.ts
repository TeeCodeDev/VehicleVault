import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/database.js';
import { RdwService } from '../services/rdwService.js';

const vehicleSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['car', 'motorcycle', 'trailer', 'van']).default('car'),
  license_plate: z.string().optional().nullable(),
  vin: z.string().optional().nullable(),
  year: z.number().int().optional().nullable(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  fuel_type: z.string().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  purchase_price: z.number().nonnegative().default(0),
  initial_odometer: z.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  status: z.enum(['active', 'archived']).default('active'),
  apk_expiration_date: z.string().optional().nullable(),
  image_path: z.string().optional().nullable(),
});

export class VehicleController {
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as string;
      const isSharedRole = req.user?.role === 'admin' || req.user?.role === 'driver';
      let sql = `
        SELECT v.*, 
          MAX(COALESCE(f.max_f, 0), COALESCE(s.max_s, 0), v.initial_odometer) as current_odometer
        FROM vehicles v
        LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_f FROM fuel_entries GROUP BY vehicle_id) f ON f.vehicle_id = v.id
        LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_s FROM service_records GROUP BY vehicle_id) s ON s.vehicle_id = v.id
        WHERE (${isSharedRole ? '1=1' : 'v.user_id = ?'})
      `;
      const params: any[] = isSharedRole ? [] : [req.user?.userId];

      if (status && status !== 'all') {
        sql += ' AND v.status = ?';
        params.push(status);
      }

      sql += ' GROUP BY v.id ORDER BY v.created_at DESC';
      const vehicles = db.query(sql, params);

      // Evaluate APK status for each vehicle
      const enriched = vehicles.map((v) => {
        const apk = RdwService.evaluateApkStatus(v.apk_expiration_date);
        return {
          ...v,
          apk_status: apk,
        };
      });

      res.json({ vehicles: enriched });
    } catch (err: any) {
      console.error('List vehicles error:', err);
      res.status(500).json({ error: 'Failed to list vehicles' });
    }
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const isSharedRole = req.user?.role === 'admin' || req.user?.role === 'driver';
      const vehicle = db.get<any>(
        `SELECT v.*, 
          MAX(COALESCE(f.max_f, 0), COALESCE(s.max_s, 0), v.initial_odometer) as current_odometer
         FROM vehicles v
         LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_f FROM fuel_entries GROUP BY vehicle_id) f ON f.vehicle_id = v.id
         LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_s FROM service_records GROUP BY vehicle_id) s ON s.vehicle_id = v.id
         WHERE v.id = ? ${isSharedRole ? '' : 'AND v.user_id = ?'}
         GROUP BY v.id`,
        isSharedRole ? [id] : [id, req.user?.userId]
      );

      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }

      res.json({
        vehicle: {
          ...vehicle,
          apk_status: RdwService.evaluateApkStatus(vehicle.apk_expiration_date),
        },
      });
    } catch (err: any) {
      console.error('Get vehicle error:', err);
      res.status(500).json({ error: 'Failed to get vehicle' });
    }
  }

  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const parse = vehicleSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0].message });
        return;
      }

      const data = parse.data;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      let rdwData: any = null;
      let apkDate = data.apk_expiration_date;

      // If Dutch license plate is supplied, attempt RDW lookup
      if (data.license_plate) {
        const rdw = await RdwService.fetchVehicleByPlate(data.license_plate);
        if (rdw) {
          rdwData = rdw.raw;
          apkDate = apkDate || rdw.vervaldatum_apk;
          if (!data.make && rdw.merk) data.make = rdw.merk;
          if (!data.model && rdw.handelsbenaming) data.model = rdw.handelsbenaming;
        }
      }

      db.run(
        `INSERT INTO vehicles (
          id, user_id, name, type, license_plate, vin, year, make, model,
          fuel_type, purchase_date, purchase_price, initial_odometer,
          notes, status, rdw_data, apk_expiration_date, image_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          req.user?.userId,
          data.name,
          data.type,
          data.license_plate ? RdwService.normalizePlate(data.license_plate) : null,
          data.vin || null,
          data.year || null,
          data.make || null,
          data.model || null,
          data.fuel_type || null,
          data.purchase_date || null,
          data.purchase_price,
          data.initial_odometer,
          data.notes || null,
          data.status,
          rdwData ? JSON.stringify(rdwData) : null,
          apkDate || null,
          data.image_path || null,
          now,
          now,
        ]
      );

      // Auto-create default maintenance interval categories for this vehicle
      const categories = db.query<any>('SELECT * FROM service_categories WHERE is_preset = 1');
      for (const cat of categories) {
        db.run(
          `INSERT INTO maintenance_intervals (
            id, vehicle_id, category_id, custom_name, interval_km, interval_months,
            last_service_date, last_service_odometer, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            id,
            cat.id,
            cat.name,
            cat.default_distance_interval,
            cat.default_time_months,
            data.purchase_date || now.split('T')[0],
            data.initial_odometer,
            now,
          ]
        );
      }

      res.status(201).json({ id, message: 'Vehicle created successfully' });
    } catch (err: any) {
      console.error('Create vehicle error:', err);
      res.status(500).json({ error: err?.message || 'Failed to create vehicle' });
    }
  }

  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const parse = vehicleSchema.partial().safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0].message });
        return;
      }

      const existing = db.get<any>('SELECT * FROM vehicles WHERE id = ? AND user_id = ?', [id, req.user?.userId]);
      if (!existing) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }

      const data = parse.data;
      const now = new Date().toISOString();

      const name = data.name !== undefined ? data.name : existing.name;
      const type = data.type !== undefined ? data.type : existing.type;
      const license_plate = data.license_plate !== undefined
        ? (data.license_plate ? RdwService.normalizePlate(data.license_plate) : null)
        : existing.license_plate;
      const vin = data.vin !== undefined ? data.vin : existing.vin;
      const year = data.year !== undefined ? data.year : existing.year;
      const make = data.make !== undefined ? data.make : existing.make;
      const model = data.model !== undefined ? data.model : existing.model;
      const fuel_type = data.fuel_type !== undefined ? data.fuel_type : existing.fuel_type;
      const purchase_date = data.purchase_date !== undefined ? data.purchase_date : existing.purchase_date;
      const purchase_price = data.purchase_price !== undefined ? data.purchase_price : existing.purchase_price;
      const initial_odometer = data.initial_odometer !== undefined ? data.initial_odometer : existing.initial_odometer;
      const notes = data.notes !== undefined ? data.notes : existing.notes;
      const status = data.status !== undefined ? data.status : existing.status;
      const apk_expiration_date = data.apk_expiration_date !== undefined ? data.apk_expiration_date : existing.apk_expiration_date;
      const image_path = data.image_path !== undefined ? data.image_path : existing.image_path;

      db.run(
        `UPDATE vehicles SET
          name = ?, type = ?, license_plate = ?, vin = ?, year = ?, make = ?, model = ?,
          fuel_type = ?, purchase_date = ?, purchase_price = ?, initial_odometer = ?,
          notes = ?, status = ?, apk_expiration_date = ?, image_path = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
        [
          name,
          type,
          license_plate,
          vin,
          year,
          make,
          model,
          fuel_type,
          purchase_date,
          purchase_price,
          initial_odometer,
          notes,
          status,
          apk_expiration_date,
          image_path,
          now,
          id,
          req.user?.userId,
        ]
      );

      res.json({ success: true, message: 'Vehicle updated' });
    } catch (err: any) {
      console.error('Update vehicle error:', err);
      res.status(500).json({ error: err?.message || 'Failed to update vehicle' });
    }
  }

  public static async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!req.file) {
        res.status(400).json({ error: 'No image file uploaded' });
        return;
      }

      const vehicle = db.get('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [id, req.user?.userId]);
      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }

      const imageFilename = req.file.filename;
      db.run('UPDATE vehicles SET image_path = ?, updated_at = ? WHERE id = ?', [
        imageFilename,
        new Date().toISOString(),
        id,
      ]);

      res.json({
        success: true,
        imagePath: imageFilename,
        message: 'Vehicle image uploaded successfully',
      });
    } catch (err: any) {
      console.error('Upload vehicle image error:', err);
      res.status(500).json({ error: err?.message || 'Failed to upload image' });
    }
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      db.run('DELETE FROM vehicles WHERE id = ? AND user_id = ?', [id, req.user?.userId]);
      res.json({ success: true, message: 'Vehicle deleted' });
    } catch (err: any) {
      console.error('Delete vehicle error:', err);
      res.status(500).json({ error: err?.message || 'Failed to delete vehicle' });
    }
  }

  public static async rdwLookup(req: Request, res: Response): Promise<void> {
    try {
      const { plate } = req.params;
      const rdw = await RdwService.fetchVehicleByPlate(plate);
      if (!rdw) {
        res.status(404).json({ error: 'No vehicle found in RDW registry for this license plate' });
        return;
      }
      res.json({ rdw });
    } catch (err: any) {
      console.error('RDW lookup error:', err);
      res.status(500).json({ error: err?.message || 'RDW lookup failed' });
    }
  }

  public static async syncApk(req: Request, res: Response): Promise<void> {
    try {
      const result = await RdwService.syncAllVehiclesApk();
      res.json(result);
    } catch (err: any) {
      console.error('Sync APK error:', err);
      res.status(500).json({ error: err?.message || 'Sync APK failed' });
    }
  }
}
