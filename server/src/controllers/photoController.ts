import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { DATA_PATHS } from '../config/env.js';
import { getVehicleAccess } from '../utils/vehicleAccess.js';

export interface VehiclePhoto {
  id: string;
  vehicle_id: string;
  file_path: string;
  category: 'exterieur' | 'interieur' | 'details' | 'gebruikssporen';
  title?: string;
  description?: string;
  sort_order: number;
  is_primary: number;
  created_at: string;
}

export class PhotoController {
  /**
   * List all photos for a vehicle.
   */
  public static async list(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const access = getVehicleAccess(id, userId);
    if (!access.hasAccess) {
      res.status(403).json({ error: 'Geen toegang tot dit voertuig' });
      return;
    }

    try {
      const photos = db.query<VehiclePhoto>(
        `SELECT * FROM vehicle_photos
         WHERE vehicle_id = ?
         ORDER BY is_primary DESC, sort_order ASC, created_at ASC`,
        [id]
      );
      res.json({ photos });
    } catch (err: any) {
      console.error('Error listing vehicle photos:', err);
      res.status(500).json({ error: err?.message || 'Fout bij het ophalen van foto\'s' });
    }
  }

  /**
   * Upload one or multiple photos for a vehicle.
   */
  public static async upload(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const access = getVehicleAccess(id, userId);
    if (!access.hasAccess || access.role === 'viewer') {
      res.status(403).json({ error: 'Geen bewerkrechten voor dit voertuig' });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;
    const singleFile = req.file;
    const uploadList = files && files.length > 0 ? files : singleFile ? [singleFile] : [];

    if (uploadList.length === 0) {
      res.status(400).json({ error: 'Geen afbeeldingsbestanden meegegeven' });
      return;
    }

    const category = (req.body.category || 'exterieur').toLowerCase();
    const title = req.body.title || null;
    const description = req.body.description || null;

    try {
      const currentPhotos = db.query<VehiclePhoto>('SELECT * FROM vehicle_photos WHERE vehicle_id = ?', [id]);
      const hasPrimary = currentPhotos.some((p) => p.is_primary === 1);

      const insertedPhotos: VehiclePhoto[] = [];

      for (let i = 0; i < uploadList.length; i++) {
        const file = uploadList[i];
        const photoId = crypto.randomUUID();
        const isPrimary = !hasPrimary && i === 0 ? 1 : 0;
        const now = new Date().toISOString();

        db.run(
          `INSERT INTO vehicle_photos (id, vehicle_id, file_path, category, title, description, sort_order, is_primary, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            photoId,
            id,
            file.filename,
            ['exterieur', 'interieur', 'details', 'gebruikssporen'].includes(category) ? category : 'exterieur',
            title,
            description,
            currentPhotos.length + i,
            isPrimary,
            now,
          ]
        );

        if (isPrimary === 1) {
          db.run('UPDATE vehicles SET image_path = ?, updated_at = ? WHERE id = ?', [file.filename, now, id]);
        }

        insertedPhotos.push({
          id: photoId,
          vehicle_id: id,
          file_path: file.filename,
          category: category as any,
          title: title || undefined,
          description: description || undefined,
          sort_order: currentPhotos.length + i,
          is_primary: isPrimary,
          created_at: now,
        });
      }

      res.status(201).json({
        message: `${insertedPhotos.length} foto('s) succesvol geüpload`,
        photos: insertedPhotos,
      });
    } catch (err: any) {
      console.error('Error uploading vehicle photos:', err);
      res.status(500).json({ error: err?.message || 'Fout bij het uploaden van foto\'s' });
    }
  }

  /**
   * Update photo metadata (title, category, sort_order, is_primary).
   */
  public static async update(req: Request, res: Response): Promise<void> {
    const { id, photoId } = req.params;
    const userId = (req as any).user?.id;

    const access = getVehicleAccess(id, userId);
    if (!access.hasAccess || access.role === 'viewer') {
      res.status(403).json({ error: 'Geen bewerkrechten voor dit voertuig' });
      return;
    }

    const { category, title, description, sort_order, is_primary } = req.body;

    try {
      const existing = db.get<VehiclePhoto>('SELECT * FROM vehicle_photos WHERE id = ? AND vehicle_id = ?', [photoId, id]);
      if (!existing) {
        res.status(404).json({ error: 'Foto niet gevonden' });
        return;
      }

      const validCategory = ['exterieur', 'interieur', 'details', 'gebruikssporen'].includes(category)
        ? category
        : existing.category;

      if (is_primary === 1 || is_primary === true) {
        // Reset all others to not primary
        db.run('UPDATE vehicle_photos SET is_primary = 0 WHERE vehicle_id = ?', [id]);
        db.run(
          `UPDATE vehicle_photos
           SET category = ?, title = ?, description = ?, sort_order = COALESCE(?, sort_order), is_primary = 1
           WHERE id = ?`,
          [validCategory, title ?? existing.title, description ?? existing.description, sort_order, photoId]
        );
        // Keep vehicles.image_path synchronized with primary photo
        db.run('UPDATE vehicles SET image_path = ?, updated_at = ? WHERE id = ?', [
          existing.file_path,
          new Date().toISOString(),
          id,
        ]);
      } else {
        db.run(
          `UPDATE vehicle_photos
           SET category = ?, title = ?, description = ?, sort_order = COALESCE(?, sort_order), is_primary = COALESCE(?, is_primary)
           WHERE id = ?`,
          [validCategory, title ?? existing.title, description ?? existing.description, sort_order, is_primary ? 1 : 0, photoId]
        );
      }

      const updated = db.get<VehiclePhoto>('SELECT * FROM vehicle_photos WHERE id = ?', [photoId]);
      res.json({ photo: updated });
    } catch (err: any) {
      console.error('Error updating vehicle photo:', err);
      res.status(500).json({ error: err?.message || 'Fout bij het bijwerken van foto' });
    }
  }

  /**
   * Delete a photo.
   */
  public static async delete(req: Request, res: Response): Promise<void> {
    const { id, photoId } = req.params;
    const userId = (req as any).user?.id;

    const access = getVehicleAccess(id, userId);
    if (!access.hasAccess || access.role === 'viewer') {
      res.status(403).json({ error: 'Geen bewerkrechten voor dit voertuig' });
      return;
    }

    try {
      const photo = db.get<VehiclePhoto>('SELECT * FROM vehicle_photos WHERE id = ? AND vehicle_id = ?', [photoId, id]);
      if (!photo) {
        res.status(404).json({ error: 'Foto niet gevonden' });
        return;
      }

      // Delete file from disk if exists
      const filePath = path.join(DATA_PATHS.vehicles, photo.file_path);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore disk unlink error
        }
      }

      db.run('DELETE FROM vehicle_photos WHERE id = ?', [photoId]);

      // If the deleted photo was primary, elect another one or reset vehicles.image_path
      if (photo.is_primary === 1) {
        const remaining = db.get<VehiclePhoto>(
          'SELECT * FROM vehicle_photos WHERE vehicle_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1',
          [id]
        );
        if (remaining) {
          db.run('UPDATE vehicle_photos SET is_primary = 1 WHERE id = ?', [remaining.id]);
          db.run('UPDATE vehicles SET image_path = ?, updated_at = ? WHERE id = ?', [
            remaining.file_path,
            new Date().toISOString(),
            id,
          ]);
        } else {
          db.run('UPDATE vehicles SET image_path = NULL, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
        }
      }

      res.json({ success: true, message: 'Foto succesvol verwijderd' });
    } catch (err: any) {
      console.error('Error deleting vehicle photo:', err);
      res.status(500).json({ error: err?.message || 'Fout bij het verwijderen van foto' });
    }
  }
}

