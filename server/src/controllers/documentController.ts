import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { DATA_PATHS } from '../config/env.js';

export class DocumentController {
  public static async list(req: Request, res: Response): Promise<void> {
    const { vehicleId } = req.params;
    const category = req.query.category as string;
    const isSharedRole = req.user?.role === 'admin' || req.user?.role === 'driver';

    const vehicle = db.get(
      `SELECT id FROM vehicles WHERE id = ? ${isSharedRole ? '' : 'AND user_id = ?'}`,
      isSharedRole ? [vehicleId] : [vehicleId, req.user?.userId]
    );

    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    let sql = `SELECT * FROM vehicle_documents WHERE vehicle_id = ? ${isSharedRole ? '' : 'AND user_id = ?'}`;
    const params: any[] = isSharedRole ? [vehicleId] : [vehicleId, req.user?.userId];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY created_at DESC';
    const documents = db.query(sql, params);

    res.json({ documents });
  }

  public static async upload(req: Request, res: Response): Promise<void> {
    const { vehicleId } = req.params;
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const isSharedRole = req.user?.role === 'admin' || req.user?.role === 'driver';
    const vehicle = db.get(
      `SELECT id FROM vehicles WHERE id = ? ${isSharedRole ? '' : 'AND user_id = ?'}`,
      isSharedRole ? [vehicleId] : [vehicleId, req.user?.userId]
    );

    if (!vehicle) {
      // Remove uploaded file if vehicle doesn't exist
      fs.unlink(req.file.path, () => {});
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const name = (req.body.name as string) || req.file.originalname;
    const category = (req.body.category as string) || 'other';
    const notes = (req.body.notes as string) || null;
    const expiresAt = (req.body.expires_at as string) || (req.body.expiresAt as string) || null;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO vehicle_documents (
        id, vehicle_id, user_id, name, category, file_path, file_size, mime_type, notes, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        vehicleId,
        req.user?.userId,
        name,
        category,
        req.file.filename,
        req.file.size,
        req.file.mimetype,
        notes,
        expiresAt,
        now,
      ]
    );

    res.status(201).json({
      id,
      name,
      filePath: req.file.filename,
      message: 'Document uploaded successfully',
    });
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const isSharedRole = req.user?.role === 'admin' || req.user?.role === 'driver';
    const doc = db.get<any>(
      `SELECT file_path FROM vehicle_documents WHERE id = ? ${isSharedRole ? '' : 'AND user_id = ?'}`,
      isSharedRole ? [id] : [id, req.user?.userId]
    );

    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Safely remove file from disk
    const fullPath = path.join(DATA_PATHS.documents, doc.file_path);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        // ignore
      }
    }

    db.run(
      `DELETE FROM vehicle_documents WHERE id = ? ${isSharedRole ? '' : 'AND user_id = ?'}`,
      isSharedRole ? [id] : [id, req.user?.userId]
    );

    res.json({ success: true, message: 'Document deleted' });
  }
}
