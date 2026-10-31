import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { DATA_PATHS } from '../config/env.js';
import { getVehicleAccess } from '../utils/vehicleAccess.js';

export class DocumentController {
  public static async list(req: Request, res: Response): Promise<void> {
    const { vehicleId } = req.params;
    const category = req.query.category as string;

    const access = getVehicleAccess(vehicleId, req.user?.userId);
    if (!access.hasAccess && req.user?.role !== 'admin' && req.user?.role !== 'driver') {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    let sql = 'SELECT * FROM vehicle_documents WHERE vehicle_id = ?';
    const params: any[] = [vehicleId];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    const sort = (req.query.sort as string) || 'date_desc';
    let orderBy = 'ORDER BY COALESCE(document_date, substr(created_at, 1, 10)) DESC, created_at DESC';
    if (sort === 'date_asc') {
      orderBy = 'ORDER BY COALESCE(document_date, substr(created_at, 1, 10)) ASC, created_at ASC';
    } else if (sort === 'name_asc') {
      orderBy = 'ORDER BY name COLLATE NOCASE ASC';
    } else if (sort === 'name_desc') {
      orderBy = 'ORDER BY name COLLATE NOCASE DESC';
    }

    sql += ` ${orderBy}`;
    const documents = db.query(sql, params);

    res.json({ documents });
  }

  public static async upload(req: Request, res: Response): Promise<void> {
    const { vehicleId } = req.params;
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const access = getVehicleAccess(vehicleId, req.user?.userId);
    const canUpload =
      (access.hasAccess && access.role !== 'viewer') ||
      req.user?.role === 'admin' ||
      req.user?.role === 'driver';

    if (!canUpload) {
      // Remove uploaded file if vehicle doesn't exist or user lacks permission
      fs.unlink(req.file.path, () => {});
      res.status(access.hasAccess ? 403 : 404).json({
        error: access.hasAccess ? 'Geen bewerkrechten voor dit voertuig' : 'Vehicle not found',
      });
      return;
    }

    const name = (req.body.name as string) || req.file.originalname;
    const category = (req.body.category as string) || 'other';
    const notes = (req.body.notes as string) || null;
    const expiresAt = (req.body.expires_at as string) || (req.body.expiresAt as string) || null;
    let documentDate = (req.body.document_date as string) || (req.body.documentDate as string) || null;

    if (!documentDate && name) {
      const dmyMatch = name.match(/\b([0-3]?[0-9])[-/.]([0-1]?[0-9])[-/.]([12][0-9]{3})\b/);
      if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        documentDate = `${year}-${month}-${day}`;
      } else {
        const ymdMatch = name.match(/\b([12][0-9]{3})[-/.]([0-1]?[0-9])[-/.]([0-3]?[0-9])\b/);
        if (ymdMatch) {
          documentDate = `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
        }
      }
    }
    if (!documentDate) {
      documentDate = new Date().toISOString().split('T')[0];
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO vehicle_documents (
        id, vehicle_id, user_id, name, category, file_path, file_size, mime_type, notes, expires_at, document_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        vehicleId,
        req.user?.userId || access.vehicle?.user_id,
        name,
        category,
        req.file.filename,
        req.file.size,
        req.file.mimetype,
        notes,
        expiresAt,
        documentDate,
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

  public static async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { name, category, document_date, expires_at, notes } = req.body;

    const doc = db.get<any>('SELECT * FROM vehicle_documents WHERE id = ?', [id]);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const access = getVehicleAccess(doc.vehicle_id, req.user?.userId);
    const canEdit =
      (access.hasAccess && access.role !== 'viewer') ||
      req.user?.role === 'admin' ||
      req.user?.role === 'driver';

    if (!canEdit) {
      res.status(access.hasAccess ? 403 : 404).json({
        error: access.hasAccess ? 'Geen bewerkrechten voor dit voertuig' : 'Document not found',
      });
      return;
    }

    const newName = name !== undefined && name !== null ? String(name).trim() : doc.name;
    const newCategory = category !== undefined && category !== null ? String(category).trim() : doc.category;
    const newDocumentDate =
      document_date !== undefined ? (document_date ? String(document_date).trim() : null) : doc.document_date;
    const newExpiresAt =
      expires_at !== undefined ? (expires_at ? String(expires_at).trim() : null) : doc.expires_at;
    const newNotes = notes !== undefined ? (notes ? String(notes).trim() : null) : doc.notes;

    db.run(
      `UPDATE vehicle_documents
       SET name = ?, category = ?, document_date = ?, expires_at = ?, notes = ?
       WHERE id = ?`,
      [newName, newCategory, newDocumentDate, newExpiresAt, newNotes, id]
    );

    const updated = db.get<any>('SELECT * FROM vehicle_documents WHERE id = ?', [id]);
    res.json({ document: updated, message: 'Document updated successfully' });
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const doc = db.get<any>('SELECT id, vehicle_id, file_path FROM vehicle_documents WHERE id = ?', [id]);

    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const access = getVehicleAccess(doc.vehicle_id, req.user?.userId);
    const canDelete =
      (access.hasAccess && access.role !== 'viewer') ||
      req.user?.role === 'admin' ||
      req.user?.role === 'driver';

    if (!canDelete) {
      res.status(access.hasAccess ? 403 : 404).json({
        error: access.hasAccess ? 'Geen bewerkrechten voor dit voertuig' : 'Document not found',
      });
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

    db.run('DELETE FROM vehicle_documents WHERE id = ?', [id]);

    res.json({ success: true, message: 'Document deleted' });
  }
}
