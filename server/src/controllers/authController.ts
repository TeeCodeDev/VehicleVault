import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/database.js';
import { isAuthDisabled, getDefaultUser, getProxyUser } from '../middleware/auth.js';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  generateApiKey,
} from '../utils/token.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createApiKeySchema = z.object({
  name: z.string().min(1).max(50),
});

function isSecureRequest(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

export class AuthController {
  public static async register(req: Request, res: Response): Promise<void> {
    try {
      const parse = registerSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0].message });
        return;
      }

      const { email, password } = parse.data;

      // Check if user exists
      const existing = db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
      if (existing) {
        res.status(409).json({ error: 'Er bestaat al een gebruiker met dit e-mailadres' });
        return;
      }

      // First user is admin, otherwise regular user
      const userCount = db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
      const role = (userCount?.count || 0) === 0 ? 'admin' : 'user';

      const userId = crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      const now = new Date().toISOString();

      db.run(
        'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, email.toLowerCase(), passwordHash, role, now, now]
      );

      const accessToken = generateAccessToken({ userId, email: email.toLowerCase(), role });
      const { token: refreshToken, hash: refreshHash, expiresAt } = generateRefreshToken();

      db.run(
        'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), userId, refreshHash, expiresAt, now]
      );

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: isSecureRequest(req),
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        accessToken,
        user: { id: userId, email: email.toLowerCase(), role },
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      res.status(500).json({ error: err?.message || 'Registratie mislukt door een serverfout' });
    }
  }

  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const parse = loginSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0].message });
        return;
      }

      const { email, password } = parse.data;
      const user = db.get<any>('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

      if (!user || !(await comparePassword(password, user.password_hash))) {
        res.status(401).json({ error: 'Ongeldig e-mailadres of wachtwoord' });
        return;
      }

      const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
      const { token: refreshToken, hash: refreshHash, expiresAt } = generateRefreshToken();
      const now = new Date().toISOString();

      db.run(
        'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), user.id, refreshHash, expiresAt, now]
      );

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: isSecureRequest(req),
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        accessToken,
        user: { id: user.id, email: user.email, role: user.role },
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: err?.message || 'Inloggen mislukt door een serverfout' });
    }
  }

  public static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies?.refresh_token;
      if (!refreshToken) {
        res.status(401).json({ error: 'Missing refresh token cookie' });
        return;
      }

      const tokenHash = hashToken(refreshToken);
      const tokenRecord = db.get<any>(
        `SELECT r.*, u.email, u.role 
         FROM refresh_tokens r
         JOIN users u ON u.id = r.user_id
         WHERE r.token_hash = ? AND r.expires_at > ?`,
        [tokenHash, new Date().toISOString()]
      );

      if (!tokenRecord) {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      const accessToken = generateAccessToken({
        userId: tokenRecord.user_id,
        email: tokenRecord.email,
        role: tokenRecord.role,
      });

      res.json({
        accessToken,
        user: { id: tokenRecord.user_id, email: tokenRecord.email, role: tokenRecord.role },
      });
    } catch (err: any) {
      console.error('Refresh token error:', err);
      res.status(500).json({ error: err?.message || 'Sessie vernieuwen mislukt' });
    }
  }

  public static async logout(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies?.refresh_token;
      if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        db.run('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
      }
      res.clearCookie('refresh_token');
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err: any) {
      console.error('Logout error:', err);
      res.status(500).json({ error: err?.message || 'Uitloggen mislukt' });
    }
  }

  public static async status(req: Request, res: Response): Promise<void> {
    try {
      const proxyUser = getProxyUser(req);
      if (proxyUser) {
        res.json({
          authDisabled: false,
          isProxyAuth: true,
          user: proxyUser,
        });
        return;
      }

      const disabled = isAuthDisabled();
      const user = disabled ? getDefaultUser() : null;
      res.json({
        authDisabled: disabled,
        isProxyAuth: false,
        user,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to check auth status' });
    }
  }

  public static async me(req: Request, res: Response): Promise<void> {
    try {
      const disabled = isAuthDisabled();
      let user = db.get('SELECT id, email, role, created_at FROM users WHERE id = ?', [req.user?.userId]);
      if (!user && disabled) {
        user = getDefaultUser();
      }
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ user, isApiKey: req.user?.isApiKey, authDisabled: disabled });
    } catch (err: any) {
      console.error('User fetch error:', err);
      res.status(500).json({ error: 'Gebruikersgegevens ophalen mislukt' });
    }
  }

  public static async listApiKeys(req: Request, res: Response): Promise<void> {
    try {
      const keys = db.query(
        'SELECT id, name, prefix, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
        [req.user?.userId]
      );
      res.json({ apiKeys: keys });
    } catch (err: any) {
      console.error('List API keys error:', err);
      res.status(500).json({ error: 'API keys ophalen mislukt' });
    }
  }

  public static async createApiKey(req: Request, res: Response): Promise<void> {
    try {
      const parse = createApiKeySchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0].message });
        return;
      }

      const { rawKey, keyHash, prefix } = generateApiKey(parse.data.name);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      db.run(
        'INSERT INTO api_keys (id, user_id, name, key_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, req.user?.userId, parse.data.name, keyHash, prefix, now]
      );

      res.status(201).json({
        id,
        name: parse.data.name,
        apiKey: rawKey, // Displayed ONLY once
        prefix,
        created_at: now,
        warning: 'Save this API key now. You will not be able to view the full key again.',
      });
    } catch (err: any) {
      console.error('Create API key error:', err);
      res.status(500).json({ error: 'API key aanmaken mislukt' });
    }
  }

  public static async deleteApiKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      db.run('DELETE FROM api_keys WHERE id = ? AND user_id = ?', [id, req.user?.userId]);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Delete API key error:', err);
      res.status(500).json({ error: 'API key verwijderen mislukt' });
    }
  }

  public static async createUser(req: Request, res: Response): Promise<void> {
    try {
      const schema = z.object({
        email: z.string().email(),
        role: z.enum(['admin', 'driver', 'user']).default('driver'),
        password: z.string().min(6).optional(),
      });

      const parse = schema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0].message });
        return;
      }

      const { email, role, password } = parse.data;
      const cleanEmail = email.trim().toLowerCase();

      const existing = db.get('SELECT id FROM users WHERE email = ?', [cleanEmail]);
      if (existing) {
        res.status(409).json({ error: 'Er bestaat al een gebruiker met dit e-mailadres' });
        return;
      }

      const userId = crypto.randomUUID();
      const passwordHash = password ? await hashPassword(password) : 'proxy_auth_placeholder';
      const now = new Date().toISOString();

      db.run(
        'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, cleanEmail, passwordHash, role, now, now]
      );

      res.status(201).json({
        success: true,
        user: { id: userId, email: cleanEmail, role, created_at: now },
      });
    } catch (err: any) {
      console.error('Create user error:', err);
      res.status(500).json({ error: err?.message || 'Gebruiker aanmaken mislukt' });
    }
  }

  public static async listUsers(_req: Request, res: Response): Promise<void> {
    try {
      const users = db.query<any>(
        'SELECT id, email, role, created_at, updated_at FROM users ORDER BY created_at ASC'
      );
      res.json({ users });
    } catch (err: any) {
      console.error('List users error:', err);
      res.status(500).json({ error: 'Gebruikerslijst ophalen mislukt' });
    }
  }

  public static async updateUserRole(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { role } = req.body;

      const validRoles = ['admin', 'driver', 'user'];
      if (!role || !validRoles.includes(role)) {
        res.status(400).json({ error: `Ongeldige rol. Kies uit: ${validRoles.join(', ')}` });
        return;
      }

      const targetUser = db.get<any>('SELECT id, email, role FROM users WHERE id = ?', [id]);
      if (!targetUser) {
        res.status(404).json({ error: 'Gebruiker niet gevonden' });
        return;
      }

      // If demoting an admin, ensure there is at least one other admin remaining
      if (targetUser.role === 'admin' && role !== 'admin') {
        const adminCount = db.get<{ count: number }>('SELECT count(*) as count FROM users WHERE role = ?', ['admin'])?.count || 0;
        if (adminCount <= 1) {
          res.status(400).json({ error: 'Kan rol niet wijzigen: Er moet minimaal één actieve beheerder blijven.' });
          return;
        }
      }

      const now = new Date().toISOString();
      db.run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, now, id]);

      res.json({
        success: true,
        user: { id: targetUser.id, email: targetUser.email, role, updated_at: now },
      });
    } catch (err: any) {
      console.error('Update user role error:', err);
      res.status(500).json({ error: err?.message || 'Rol bijwerken mislukt' });
    }
  }

  public static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const targetUser = db.get<any>('SELECT id, email, role FROM users WHERE id = ?', [id]);
      if (!targetUser) {
        res.status(404).json({ error: 'Gebruiker niet gevonden' });
        return;
      }

      if (targetUser.role === 'admin') {
        const adminCount = db.get<{ count: number }>('SELECT count(*) as count FROM users WHERE role = ?', ['admin'])?.count || 0;
        if (adminCount <= 1) {
          res.status(400).json({ error: 'De laatste beheerder kan niet worden verwijderd.' });
          return;
        }
      }

      if (req.user?.userId === id) {
        res.status(400).json({ error: 'U kunt uw eigen ingelogde account niet verwijderen.' });
        return;
      }

      db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [id]);
      db.run('DELETE FROM api_keys WHERE user_id = ?', [id]);
      db.run('DELETE FROM users WHERE id = ?', [id]);

      res.json({ success: true, message: 'Gebruiker succesvol verwijderd' });
    } catch (err: any) {
      console.error('Delete user error:', err);
      res.status(500).json({ error: err?.message || 'Gebruiker verwijderen mislukt' });
    }
  }
}
