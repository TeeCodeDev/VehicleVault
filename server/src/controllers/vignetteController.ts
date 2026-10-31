import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { getVehicleAccess } from '../utils/vehicleAccess.js';

export interface VignetteStatusInfo {
  status: 'active' | 'expiring_soon' | 'expired' | 'future' | 'lifetime';
  daysRemaining: number | null;
}

export function computeVignetteStatus(validFrom?: string | null, validUntil?: string | null): VignetteStatusInfo {
  if (!validUntil) {
    return { status: 'lifetime', daysRemaining: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (validFrom) {
    const fromDate = new Date(validFrom);
    fromDate.setHours(0, 0, 0, 0);
    if (fromDate.getTime() > today.getTime()) {
      const daysUntilStart = Math.ceil((fromDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { status: 'future', daysRemaining: daysUntilStart };
    }
  }

  const untilDate = new Date(validUntil);
  untilDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((untilDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: 'expired', daysRemaining: diffDays };
  }
  if (diffDays <= 30) {
    return { status: 'expiring_soon', daysRemaining: diffDays };
  }
  return { status: 'active', daysRemaining: diffDays };
}

export class VignetteController {
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const vehicleId = (req.params.vehicleId || req.query.vehicleId) as string;
      if (!vehicleId) {
        res.status(400).json({ error: 'vehicleId is required' });
        return;
      }

      const access = getVehicleAccess(vehicleId, req.user?.userId);
      if (!access.hasAccess && req.user?.role !== 'admin' && req.user?.role !== 'driver') {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }

      const rows = db.query<any>(
        `SELECT v.*, d.name as document_name, d.file_path as document_file_path
         FROM vehicle_vignettes v
         LEFT JOIN vehicle_documents d ON v.document_id = d.id
         WHERE v.vehicle_id = ?
         ORDER BY 
           CASE WHEN v.valid_until IS NULL OR v.valid_until = '' THEN 1 ELSE 0 END,
           v.valid_until DESC,
           v.created_at DESC`,
        [vehicleId]
      );

      const vignettes = rows.map((v) => {
        const { status, daysRemaining } = computeVignetteStatus(v.valid_from, v.valid_until);
        return {
          ...v,
          status,
          days_remaining: daysRemaining,
        };
      });

      res.json({ vignettes });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list vignettes' });
    }
  }

  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const {
        vehicleId,
        country,
        vignetteType = 'toll_digital',
        name,
        validFrom = null,
        validUntil = null,
        cost = 0,
        referenceNumber = null,
        documentId = null,
        notes = null,
      } = req.body;

      if (!vehicleId || !country || !name) {
        res.status(400).json({ error: 'vehicleId, country and name are required' });
        return;
      }

      const access = getVehicleAccess(vehicleId, req.user?.userId);
      const canManage =
        (access.hasAccess && access.role !== 'viewer') ||
        req.user?.role === 'admin' ||
        req.user?.role === 'driver';

      if (!canManage) {
        res.status(403).json({ error: 'Permission denied to manage vignettes' });
        return;
      }

      const id = crypto.randomUUID();
      const userId = req.user?.userId || access.vehicle?.user_id;
      const now = new Date().toISOString();

      db.run(
        `INSERT INTO vehicle_vignettes (
          id, vehicle_id, user_id, country, vignette_type, name, valid_from, valid_until,
          cost, reference_number, document_id, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          vehicleId,
          userId,
          country.trim().toUpperCase(),
          vignetteType,
          name.trim(),
          validFrom || null,
          validUntil || null,
          Number(cost) || 0,
          referenceNumber ? referenceNumber.trim() : null,
          documentId || null,
          notes ? notes.trim() : null,
          now,
        ]
      );

      const created = db.get<any>('SELECT * FROM vehicle_vignettes WHERE id = ?', [id]);
      const { status, daysRemaining } = computeVignetteStatus(created.valid_from, created.valid_until);

      res.status(201).json({
        vignette: {
          ...created,
          status,
          days_remaining: daysRemaining,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create vignette' });
    }
  }

  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const existing = db.get<any>('SELECT * FROM vehicle_vignettes WHERE id = ?', [id]);
      if (!existing) {
        res.status(404).json({ error: 'Vignette not found' });
        return;
      }

      const access = getVehicleAccess(existing.vehicle_id, req.user?.userId);
      const canManage =
        (access.hasAccess && access.role !== 'viewer') ||
        req.user?.role === 'admin' ||
        req.user?.role === 'driver';

      if (!canManage) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const {
        country,
        vignetteType,
        name,
        validFrom,
        validUntil,
        cost,
        referenceNumber,
        documentId,
        notes,
      } = req.body;

      db.run(
        `UPDATE vehicle_vignettes SET
          country = COALESCE(?, country),
          vignette_type = COALESCE(?, vignette_type),
          name = COALESCE(?, name),
          valid_from = ?,
          valid_until = ?,
          cost = COALESCE(?, cost),
          reference_number = ?,
          document_id = ?,
          notes = ?
        WHERE id = ?`,
        [
          country !== undefined ? country.trim().toUpperCase() : null,
          vignetteType ?? null,
          name !== undefined ? name.trim() : null,
          validFrom !== undefined ? (validFrom || null) : existing.valid_from,
          validUntil !== undefined ? (validUntil || null) : existing.valid_until,
          cost !== undefined ? Number(cost) : null,
          referenceNumber !== undefined ? (referenceNumber ? referenceNumber.trim() : null) : existing.reference_number,
          documentId !== undefined ? (documentId || null) : existing.document_id,
          notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
          id,
        ]
      );

      const updated = db.get<any>('SELECT * FROM vehicle_vignettes WHERE id = ?', [id]);
      const { status, daysRemaining } = computeVignetteStatus(updated.valid_from, updated.valid_until);

      res.json({
        vignette: {
          ...updated,
          status,
          days_remaining: daysRemaining,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update vignette' });
    }
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const existing = db.get<any>('SELECT * FROM vehicle_vignettes WHERE id = ?', [id]);
      if (!existing) {
        res.status(404).json({ error: 'Vignette not found' });
        return;
      }

      const access = getVehicleAccess(existing.vehicle_id, req.user?.userId);
      const canManage =
        (access.hasAccess && access.role !== 'viewer') ||
        req.user?.role === 'admin' ||
        req.user?.role === 'driver';

      if (!canManage) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      db.run('DELETE FROM vehicle_vignettes WHERE id = ?', [id]);
      res.json({ success: true, message: 'Vignette deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete vignette' });
    }
  }
}
