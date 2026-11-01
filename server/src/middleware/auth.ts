import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, hashToken } from '../utils/token.js';
import { db } from '../db/database.js';
import { env } from '../config/env.js';

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
  if (process.env.DISABLE_AUTH === 'true' || process.env.AUTH_DISABLED === 'true' || env.DISABLE_AUTH) {
    return true;
  }
  try {
    const row = db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', ['disable_auth']);
    return row?.value === 'true';
  } catch (err: any) {
    console.error('[AUTH] Error checking disable_auth setting:', err?.message);
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
  } catch (err: any) {
    console.error('[AUTH] Failed to resolve default user in disabled-auth mode:', err?.message);
    throw new Error('Database unavailable for default user resolution');
  }
}

export function isProxyAuthEnabled(): boolean {
  if (process.env.TRUST_PROXY_HEADERS === 'false' || process.env.ENABLE_PROXY_AUTH === 'false') {
    return false;
  }
  if (process.env.TRUST_PROXY_HEADERS === 'true' || process.env.ENABLE_PROXY_AUTH === 'true' || env.TRUST_PROXY_HEADERS) {
    return true;
  }
  try {
    const row = db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', ['enable_proxy_auth']);
    if (row) return row.value === 'true';
  } catch (err: any) {
    console.error('[AUTH] Error checking enable_proxy_auth setting:', err?.message);
  }
  return false; // Secure default: proxy auth is disabled unless explicitly turned on!
}

export function isTrustedProxy(req: Request): boolean {
  const remoteIp = (req.socket?.remoteAddress || req.ip || '').replace(/^.*:/, '').toLowerCase();
  const fullRemote = (req.socket?.remoteAddress || '').toLowerCase();

  // Always trust loopback
  if (remoteIp === '127.0.0.1' || fullRemote === '::1' || remoteIp === 'localhost') {
    return true;
  }

  // Check configured trusted proxies list
  for (const trusted of env.TRUSTED_PROXIES) {
    if (trusted === '*' || trusted === remoteIp || fullRemote === trusted) {
      return true;
    }
    // Subnet checks for standard private networks
    if (trusted.startsWith('10.') && remoteIp.startsWith('10.')) return true;
    if (trusted.startsWith('192.168.') && remoteIp.startsWith('192.168.')) return true;
    if (trusted.startsWith('172.') && remoteIp.startsWith('172.')) {
      const secondOctet = parseInt(remoteIp.split('.')[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
  }
  return false;
}

export function getProxyUser(req: Request): AuthenticatedUser | null {
  if (!isProxyAuthEnabled()) {
    return null;
  }

  // Reject proxy headers from untrusted upstream connections
  if (!isTrustedProxy(req)) {
    console.warn(`[SECURITY] Ignored untrusted proxy auth headers from IP: ${req.socket?.remoteAddress || req.ip}`);
    return null;
  }

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
    if (!env.ALLOW_PROXY_REGISTRATION) {
      console.warn(`[SECURITY] Proxy registration rejected for ${email} (registration disabled)`);
      return null;
    }
    // Auto-provision user from reverse proxy: first user is admin ONLY if database has 0 users.
    // Subsequent users are strictly regular 'driver' / 'user', never admin by arbitrary header injection.
    const userCount = db.get<{ count: number }>('SELECT count(*) as count FROM users')?.count || 0;
    const role = userCount === 0 ? 'admin' : 'driver';
    const newUserId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.run(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [newUserId, email, 'proxy_auth_placeholder', role, now, now]
    );
    user = { id: newUserId, email, role };
    console.log(`[AUTH] Auto-provisioned proxy user ${email} with role ${role}`);
  } else {
    try {
      const now = new Date().toISOString();
      db.run('UPDATE users SET last_login_at = ?, last_active_at = ? WHERE id = ?', [now, now, user.id]);
    } catch (err: any) {
      console.error('[AUTH] Failed to record proxy user login timestamp:', err?.message);
    }
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    isApiKey: false,
  };
}

export function authenticateApiKey(token: string): AuthenticatedUser | null {
  if (!token || !token.startsWith('vkv_')) {
    return null;
  }
  const keyHash = hashToken(token);
  const keyRecord = db.get<{ id: string; user_id: string; email: string; role: string }>(
    `SELECT k.id, k.user_id, u.email, u.role
     FROM api_keys k
     JOIN users u ON u.id = k.user_id
     WHERE k.key_hash = ?`,
    [keyHash]
  );

  if (!keyRecord) {
    return null;
  }

  try {
    db.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', [new Date().toISOString(), keyRecord.id]);
  } catch (err: any) {
    console.error('[AUTH] Failed to update API key last_used_at:', err?.message);
  }

  return {
    userId: keyRecord.user_id,
    email: keyRecord.email,
    role: keyRecord.role,
    isApiKey: true,
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

  let explicitToken: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    explicitToken = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    explicitToken = apiKeyHeader.trim();
  }

  // 1. If an explicit API Key (vkv_) is provided, authenticate as the owner of that API key
  if (explicitToken && explicitToken.startsWith('vkv_')) {
    const apiKeyUser = authenticateApiKey(explicitToken);
    if (!apiKeyUser) {
      res.status(401).json({ error: 'Unauthorized: Invalid or revoked API key' });
      return;
    }
    req.user = apiKeyUser;
    return next();
  }

  // 2. Check for reverse proxy authentication headers (if enabled and coming from trusted proxy)
  const proxyUser = getProxyUser(req);
  if (proxyUser) {
    req.user = proxyUser;
    return next();
  }

  // 3. If authentication is disabled (via env DISABLE_AUTH=true or UI setting disable_auth=true)
  if (isAuthDisabled()) {
    try {
      req.user = getDefaultUser();
      return next();
    } catch {
      res.status(500).json({ error: 'Authentication service unavailable' });
      return;
    }
  }

  const token = explicitToken;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing authorization token or API key' });
    return;
  }

  // 4. Standard JWT Access Token
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

  // Track modification activity
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.user?.userId) {
    try {
      db.run('UPDATE users SET last_active_at = ? WHERE id = ?', [new Date().toISOString(), req.user.userId]);
    } catch (err: any) {
      console.error('[AUTH] Failed to update user last_active_at:', err?.message);
    }
  }

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
