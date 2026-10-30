import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/database.js';
import { RdwService } from '../services/rdwService.js';
import { getVehicleAccess } from '../utils/vehicleAccess.js';

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
  plate_country: z.enum(['NL', 'BE', 'DE', 'EU', 'OTHER']).default('NL'),
  image_path: z.string().optional().nullable(),
});

export class VehicleController {
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as string;
      const userId = req.user?.userId;
      const showAll = req.query.all === 'true' && req.user?.role === 'admin';

      let sql = `
        SELECT v.*, 
          u.email as owner_email,
          CASE WHEN v.user_id = ? THEN 1 ELSE 0 END as is_owner,
          CASE WHEN v.user_id = ? THEN 'owner' ELSE COALESCE(vs.role, 'editor') END as access_role,
          MAX(COALESCE(f.max_f, 0), COALESCE(s.max_s, 0), v.initial_odometer) as current_odometer,
          sc.is_active as is_showcase_active,
          sc.public_slug as showcase_slug
        FROM vehicles v
        LEFT JOIN users u ON u.id = v.user_id
        LEFT JOIN vehicle_shares vs ON vs.vehicle_id = v.id AND vs.user_id = ?
        LEFT JOIN vehicle_showcases sc ON sc.vehicle_id = v.id
        LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_f FROM fuel_entries GROUP BY vehicle_id) f ON f.vehicle_id = v.id
        LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_s FROM service_records GROUP BY vehicle_id) s ON s.vehicle_id = v.id
        WHERE (${showAll ? '1=1' : '(v.user_id = ? OR vs.user_id = ?)'})
      `;
      const params: any[] = [userId, userId, userId];
      if (!showAll) {
        params.push(userId, userId);
      }

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
          is_owner: Boolean(v.is_owner),
          is_showcase_active: v.is_showcase_active === 1,
          showcase_slug: v.showcase_slug || undefined,
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
      const userId = req.user?.userId;
      const access = getVehicleAccess(id, userId);

      if (!access.hasAccess && req.user?.role !== 'admin') {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }

      const vehicle = db.get<any>(
        `SELECT v.*, 
          u.email as owner_email,
          CASE WHEN v.user_id = ? THEN 1 ELSE 0 END as is_owner,
          CASE WHEN v.user_id = ? THEN 'owner' ELSE COALESCE(vs.role, 'editor') END as access_role,
          MAX(COALESCE(f.max_f, 0), COALESCE(s.max_s, 0), v.initial_odometer) as current_odometer,
          sc.is_active as is_showcase_active,
          sc.public_slug as showcase_slug
         FROM vehicles v
         LEFT JOIN users u ON u.id = v.user_id
         LEFT JOIN vehicle_shares vs ON vs.vehicle_id = v.id AND vs.user_id = ?
         LEFT JOIN vehicle_showcases sc ON sc.vehicle_id = v.id
         LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_f FROM fuel_entries GROUP BY vehicle_id) f ON f.vehicle_id = v.id
         LEFT JOIN (SELECT vehicle_id, MAX(odometer) as max_s FROM service_records GROUP BY vehicle_id) s ON s.vehicle_id = v.id
         WHERE v.id = ?
         GROUP BY v.id`,
        [userId, userId, userId, id]
      );

      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }

      res.json({
        vehicle: {
          ...vehicle,
          is_owner: Boolean(vehicle.is_owner),
          is_showcase_active: vehicle.is_showcase_active === 1,
          showcase_slug: vehicle.showcase_slug || undefined,
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
      const plateCountry = data.plate_country || 'NL';

      // If Dutch license plate is supplied, attempt RDW lookup
      if (data.license_plate && plateCountry === 'NL') {
        const rdw = await RdwService.fetchVehicleByPlate(data.license_plate);
        if (rdw) {
          rdwData = rdw.raw;
          apkDate = apkDate || rdw.vervaldatum_apk;
          if (!data.make && rdw.merk) data.make = rdw.merk;
          if (!data.model && rdw.handelsbenaming) data.model = rdw.handelsbenaming;
          if (!data.fuel_type && rdw.brandstof_omschrijving) data.fuel_type = rdw.brandstof_omschrijving;
        }
      }

      db.run(
        `INSERT INTO vehicles (
          id, user_id, name, type, license_plate, vin, year, make, model,
          fuel_type, purchase_date, purchase_price, initial_odometer,
          notes, status, rdw_data, apk_expiration_date, plate_country, image_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          req.user?.userId,
          data.name,
          data.type,
          data.license_plate ? (plateCountry === 'NL' ? RdwService.normalizePlate(data.license_plate) : data.license_plate.trim().toUpperCase()) : null,
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
          plateCountry,
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

      const access = getVehicleAccess(id, req.user?.userId);
      if (!access.hasAccess || (!access.isOwner && access.role !== 'editor')) {
        res.status(403).json({ error: 'Geen bewerkrechten voor dit voertuig' });
        return;
      }
      const existing = access.vehicle;

      const data = parse.data;
      const now = new Date().toISOString();

      const name = data.name !== undefined ? data.name : existing.name;
      const type = data.type !== undefined ? data.type : existing.type;
      const plate_country = data.plate_country !== undefined ? data.plate_country : (existing.plate_country || 'NL');
      const license_plate = data.license_plate !== undefined
        ? (data.license_plate ? (plate_country === 'NL' ? RdwService.normalizePlate(data.license_plate) : data.license_plate.trim().toUpperCase()) : null)
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
          notes = ?, status = ?, apk_expiration_date = ?, plate_country = ?, image_path = ?, updated_at = ?
         WHERE id = ?`,
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
          plate_country,
          image_path,
          now,
          id,
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

      const access = getVehicleAccess(id, req.user?.userId);
      if (!access.hasAccess || (!access.isOwner && access.role !== 'editor')) {
        res.status(403).json({ error: 'Geen bewerkrechten voor dit voertuig' });
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
      const access = getVehicleAccess(id, req.user?.userId);
      if (!access.isOwner && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Alleen de eigenaar kan dit voertuig verwijderen' });
        return;
      }

      db.run('DELETE FROM vehicles WHERE id = ?', [id]);
      res.json({ success: true, message: 'Vehicle deleted' });
    } catch (err: any) {
      console.error('Delete vehicle error:', err);
      res.status(500).json({ error: err?.message || 'Failed to delete vehicle' });
    }
  }

  public static async getShares(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.userId;
      const access = getVehicleAccess(id, currentUserId);
      if (!access.isOwner && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Alleen de eigenaar kan gedeelde gebruikers inzien' });
        return;
      }

      const shares = db.query<any>(
        `SELECT vs.id, vs.vehicle_id, vs.user_id, vs.role, vs.created_at, u.email
         FROM vehicle_shares vs
         JOIN users u ON u.id = vs.user_id
         WHERE vs.vehicle_id = ?
         ORDER BY vs.created_at ASC`,
        [id]
      );

      res.json({ shares });
    } catch (err: any) {
      console.error('Get vehicle shares error:', err);
      res.status(500).json({ error: 'Gedeelde gebruikers ophalen mislukt' });
    }
  }

  public static async addShare(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.userId;
      const access = getVehicleAccess(id, currentUserId);
      if (!access.isOwner && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Alleen de eigenaar kan dit voertuig delen' });
        return;
      }

      const { email, role = 'editor' } = req.body;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'Geldig e-mailadres is verplicht' });
        return;
      }

      const targetUser = db.get<any>('SELECT id, email FROM users WHERE email = ?', [email.trim().toLowerCase()]);
      if (!targetUser) {
        res.status(404).json({ error: 'Er is geen gebruiker gevonden met dit e-mailadres' });
        return;
      }

      if (targetUser.id === access.vehicle?.user_id) {
        res.status(400).json({ error: 'Dit voertuig is al eigendom van deze gebruiker' });
        return;
      }

      const validRoles = ['editor', 'viewer'];
      const targetRole = validRoles.includes(role) ? role : 'editor';

      const shareId = crypto.randomUUID();
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO vehicle_shares (id, vehicle_id, user_id, role, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(vehicle_id, user_id) DO UPDATE SET role = excluded.role`,
        [shareId, id, targetUser.id, targetRole, now]
      );

      res.status(201).json({
        message: `Voertuig succesvol gedeeld met ${targetUser.email}`,
        share: {
          id: shareId,
          vehicle_id: id,
          user_id: targetUser.id,
          email: targetUser.email,
          role: targetRole,
          created_at: now,
        },
      });
    } catch (err: any) {
      console.error('Add vehicle share error:', err);
      res.status(500).json({ error: err?.message || 'Voertuig delen mislukt' });
    }
  }

  public static async removeShare(req: Request, res: Response): Promise<void> {
    try {
      const { id, userId: targetUserId } = req.params;
      const currentUserId = req.user?.userId;
      const access = getVehicleAccess(id, currentUserId);
      if (!access.isOwner && req.user?.role !== 'admin' && currentUserId !== targetUserId) {
        res.status(403).json({ error: 'Alleen de eigenaar kan toegang intrekken' });
        return;
      }

      db.run('DELETE FROM vehicle_shares WHERE vehicle_id = ? AND user_id = ?', [id, targetUserId]);
      res.json({ message: 'Toegang succesvol ingetrokken' });
    } catch (err: any) {
      console.error('Remove vehicle share error:', err);
      res.status(500).json({ error: 'Toegang intrekken mislukt' });
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
