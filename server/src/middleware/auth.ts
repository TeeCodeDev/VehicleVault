import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, hashToken } from '../utils/token.js';
import { db } from '../db/database.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  isApiKey?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing authorization token or API key' });
    return;
  }

  // Check if it is an API Key (starts with vkv_)
  if (token.startsWith('vkv_')) {
    const keyHash = hashToken(token);
    const keyRecord = db.get<{ id: string; user_id: string; email: string; role: string }>(
      `SELECT k.id, k.user_id, u.email, u.role
       FROM api_keys k
       JOIN users u ON u.id = k.user_id
       WHERE k.key_hash = ?`,
      [keyHash]
    );

    if (!keyRecord) {
      res.status(401).json({ error: 'Unauthorized: Invalid or revoked API key' });
      return;
    }

    // Update last_used_at asynchronously
    db.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', [new Date().toISOString(), keyRecord.id]);

    req.user = {
      userId: keyRecord.user_id,
      email: keyRecord.email,
      role: keyRecord.role,
      isApiKey: true,
    };
    next();
    return;
  }

  // Standard JWT Access Token
  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired access token' });
    return;
  }

  req.user = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    isApiKey: false,
  };

  next();
}

