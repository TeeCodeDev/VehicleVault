import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database.js';
import { verifyAccessToken, hashToken } from '../utils/token.js';
import { getProxyUser, isAuthDisabled } from './auth.js';
import { getVehicleAccess } from '../utils/vehicleAccess.js';

type ProtectedFolder = 'documents' | 'invoices' | 'receipts';

interface ResolvedUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Resolve the authenticated user from bearer token, query token, session cookie, or trusted proxy.
 */
function resolveFileRequestUser(req: Request): ResolvedUser | null {
  // 1. Check if user is already attached by previous middleware
  if (req.user) {
    return {
      id: req.user.userId,
      email: req.user.email,
      role: req.user.role,
    };
  }

  // 2. Check Authorization Header or query token
  const authHeader = req.headers.authorization;
  const queryToken = (req.query?.token as string) || (req.query?.auth as string);
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (queryToken) {
    token = queryToken.trim();
  }

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      return {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      };
    }
  }

  // 3. Check Session Cookie (refresh_token)
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    try {
      const tokenHash = hashToken(refreshToken);
      const row = db.get<{ user_id: string; email: string; role: string; expires_at: string }>(
        `SELECT r.user_id, u.email, u.role, r.expires_at
         FROM refresh_tokens r
         JOIN users u ON u.id = r.user_id
         WHERE r.token_hash = ?`,
        [tokenHash]
      );
      if (row && new Date(row.expires_at) > new Date()) {
        return {
          id: row.user_id,
          email: row.email,
          role: row.role,
        };
      }
    } catch (err: any) {
      console.error('[FILE-AUTH] Error checking session cookie:', err?.message);
    }
  }

  // 4. Check Reverse Proxy User (only if enabled & from trusted upstream)
  const proxyUser = getProxyUser(req);
  if (proxyUser) {
    return {
      id: proxyUser.userId,
      email: proxyUser.email,
      role: proxyUser.role,
    };
  }

  return null;
}

/**
 * Security Middleware to protect private user documents, maintenance invoices, and fuel receipts.
 * Prevents unauthenticated direct URL access and enforces multi-tenant vehicle isolation.
 */
export function requireFileAuth(folder: ProtectedFolder) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // If authentication is disabled globally, allow access
    if (isAuthDisabled()) {
      return next();
    }

    const user = resolveFileRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Inloggen vereist om dit bestand te bekijken.' });
      return;
    }

    // Admins have universal access across the fleet
    if (user.role === 'admin') {
      return next();
    }

    // Extract filename from URL (e.g. /uploads/documents/abc-123.pdf -> abc-123.pdf)
    const filename = req.path.replace(/^\/+/, '');
    if (!filename) {
      res.status(400).json({ error: 'Ongeldige bestandsaanvraag.' });
      return;
    }

    try {
      let vehicleId: string | undefined;

      if (folder === 'documents') {
        const doc = db.get<{ vehicle_id: string; user_id: string }>(
          'SELECT vehicle_id, user_id FROM vehicle_documents WHERE file_path = ?',
          [filename]
        );
        if (doc) {
          vehicleId = doc.vehicle_id;
        }
      } else if (folder === 'invoices') {
        const record = db.get<{ vehicle_id: string }>(
          'SELECT vehicle_id FROM service_records WHERE invoice_path = ?',
          [filename]
        );
        if (record) {
          vehicleId = record.vehicle_id;
        }
      } else if (folder === 'receipts') {
        const entry = db.get<{ vehicle_id: string }>(
          'SELECT vehicle_id FROM fuel_entries WHERE receipt_path = ?',
          [filename]
        );
        if (entry) {
          vehicleId = entry.vehicle_id;
        }
      }

      if (!vehicleId) {
        // File is either deleted from DB or does not exist
        res.status(404).json({ error: 'Bestand niet gevonden.' });
        return;
      }

      // Check if user has permission to access the vehicle
      const access = getVehicleAccess(vehicleId, user.id);
      if (!access.hasAccess && user.role !== 'driver') {
        res.status(403).json({ error: 'Toegang geweigerd: Je hebt geen toegang tot dit document.' });
        return;
      }

      // Authorized! Proceed to static file streaming
      next();
    } catch (err: any) {
      console.error(`[FILE-AUTH] Error verifying access for ${folder}/${filename}:`, err?.message);
      res.status(500).json({ error: 'Interne serverfout bij bestandsverificatie.' });
    }
  };
}

