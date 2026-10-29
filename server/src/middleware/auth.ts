import crypto from 'node:crypto';
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

export function isAuthDisabled(): boolean {
  if (process.env.DISABLE_AUTH === 'true' || process.env.AUTH_DISABLED === 'true') {
    return true;
  }
  try {
    const row = db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', ['disable_auth']);
    return row?.value === 'true';
  } catch {
    return false;
  }
}

export function getDefaultUser(): AuthenticatedUser {
  try {
    const existing = db.get<{ id: string; email: string; role: string }>(
      "SELECT id, email, role FROM users ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at ASC LIMIT 1"
    );
    if (existing) {
      return {
        userId: existing.id,
        email: existing.email,
        role: existing.role,
        isApiKey: false,
      };
    }

    const id = '00000000-0000-0000-0000-000000000001';
    const email = 'admin@vehiclevault.local';
    const now = new Date().toISOString();
    db.run(
      "INSERT OR IGNORE INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, email, 'disabled_auth_placeholder', 'admin', now, now]
    );
    return {
      userId: id,
      email,
      role: 'admin',
      isApiKey: false,
    };
  } catch {
    return {
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'admin@vehiclevault.local',
      role: 'admin',
      isApiKey: false,
    };
  }
}

export function getProxyUser(req: Request): AuthenticatedUser | null {
  // Check for reverse proxy authentication headers (Pangolin, Authelia, Authentik, Traefik, Cloudflare Access)
  const proxyUserHeader = (
    req.headers['remote-email'] ||
    req.headers['remote-user'] ||
    req.headers['x-forwarded-email'] ||
    req.headers['x-forwarded-user'] ||
    req.headers['x-pangolin-user']
  ) as string | undefined;

  if (!proxyUserHeader || typeof proxyUserHeader !== 'string' || proxyUserHeader.trim().length === 0) {
    return null;
  }

  const email = proxyUserHeader.trim().toLowerCase();
  let user = db.get<{ id: string; email: string; role: string }>(
    'SELECT id, email, role FROM users WHERE email = ?',
    [email]
  );

  if (!user) {
    // Auto-provision user from reverse proxy
    const userCount = db.get<{ count: number }>('SELECT count(*) as count FROM users')?.count || 0;
    const groupsHeader = (
      (req.headers['remote-groups'] || req.headers['x-forwarded-groups'] || req.headers['remote-role']) as string || ''
    ).toLowerCase();
    const isAdmin = userCount === 0 || groupsHeader.includes('admin');
    const role = isAdmin ? 'admin' : 'driver';
    const newUserId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.run(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [newUserId, email, 'proxy_auth_placeholder', role, now, now]
    );
    user = { id: newUserId, email, role };
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    isApiKey: false,
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // 1. Check for reverse proxy authentication headers (Pangolin, Authelia, Authentik, etc.)
  // Proxy headers ALWAYS take precedence because the proxy specifies the exact identity of the caller!
  const proxyUser = getProxyUser(req);
  if (proxyUser) {
    req.user = proxyUser;
    return next();
  }

  // 2. If authentication is disabled (via env DISABLE_AUTH=true or UI setting disable_auth=true)
  if (isAuthDisabled()) {
    req.user = getDefaultUser();
    return next();
  }

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

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (isAuthDisabled()) {
    return next();
  }

  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Toegang geweigerd: Alleen beheerders hebben toegang tot deze actie.' });
    return;
  }

  next();
}
