import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/database.js';
import { isAuthDisabled, getDefaultUser, getProxyUser } from '../middleware/auth.js';
import { EmailService } from '../services/emailService.js';
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
  rememberMe: z.boolean().optional(),
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
        maxAge: 90 * 24 * 60 * 60 * 1000,
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

      // Track last login and active timestamp
      db.run('UPDATE users SET last_login_at = ?, last_active_at = ? WHERE id = ?', [now, now, user.id]);

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: isSecureRequest(req),
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60 * 1000,
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

      // Update last login and active timestamp on session refresh
      const now = new Date().toISOString();
      db.run('UPDATE users SET last_login_at = ?, last_active_at = ? WHERE id = ?', [now, now, tokenRecord.user_id]);

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

      const userCount = db.get<{ count: number }>('SELECT count(*) as count FROM users')?.count || 0;
      const hasUsers = userCount > 0;

      const disabled = isAuthDisabled();
      const user = disabled ? getDefaultUser() : null;
      res.json({
        authDisabled: disabled,
        isProxyAuth: false,
        hasUsers,
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

  public static async listShareableUsers(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.userId;
      const users = db.query<any>(
        'SELECT id, email, role FROM users WHERE id != ? ORDER BY email ASC',
        currentUserId ? [currentUserId] : []
      );
      res.json({ users });
    } catch (err: any) {
      console.error('List shareable users error:', err);
      res.status(500).json({ error: 'Gebruikers ophalen mislukt' });
    }
  }

  public static async listUsers(_req: Request, res: Response): Promise<void> {
    try {
      const rows = db.query<any>(`
        SELECT
          u.id,
          u.email,
          u.role,
          u.created_at,
          u.updated_at,
          u.last_login_at,
          u.last_active_at,
          (SELECT MAX(created_at) FROM refresh_tokens WHERE user_id = u.id) AS last_token_at,
          (SELECT MAX(last_used_at) FROM api_keys WHERE user_id = u.id) AS last_api_key_at,
          (SELECT MAX(updated_at) FROM vehicles WHERE user_id = u.id) AS last_vehicle_mod_at,
          (SELECT MAX(fe.created_at) FROM fuel_entries fe JOIN vehicles v ON fe.vehicle_id = v.id WHERE v.user_id = u.id) AS last_fuel_at,
          (SELECT MAX(sr.created_at) FROM service_records sr JOIN vehicles v ON sr.vehicle_id = v.id WHERE v.user_id = u.id) AS last_service_at,
          (SELECT MAX(t.created_at) FROM trips t JOIN vehicles v ON t.vehicle_id = v.id WHERE v.user_id = u.id) AS last_trip_at,
          (SELECT COUNT(*) FROM vehicles WHERE user_id = u.id) AS vehicle_count,
          (SELECT COUNT(*) FROM vehicle_shares WHERE user_id = u.id) AS shared_vehicle_count
        FROM users u
        ORDER BY u.created_at ASC
      `);

      const now = Date.now();
      const users = rows.map((r) => {
        // Collect candidate timestamps
        const loginCandidates = [r.last_login_at, r.last_token_at].filter(Boolean);
        const changeCandidates = [r.last_vehicle_mod_at, r.last_fuel_at, r.last_service_at, r.last_trip_at].filter(Boolean);
        const allActivityCandidates = [
          r.last_active_at,
          ...loginCandidates,
          ...changeCandidates,
          r.last_api_key_at,
        ].filter(Boolean);

        const getLatest = (arr: string[]) => {
          if (arr.length === 0) return null;
          return arr.reduce((max, cur) => (new Date(cur).getTime() > new Date(max).getTime() ? cur : max));
        };

        const lastLogin = getLatest(loginCandidates);
        const lastChange = getLatest(changeCandidates);
        const lastActive = getLatest(allActivityCandidates);

        // Determine dormant status (inactive >= 60 days, or registered >= 14 days ago without activity)
        let isDormant = false;
        if (lastActive) {
          const diffDays = Math.floor((now - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 60) isDormant = true;
        } else if (r.created_at) {
          const createdDays = Math.floor((now - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
          if (createdDays >= 14) isDormant = true;
        }

        return {
          id: r.id,
          email: r.email,
          role: r.role,
          created_at: r.created_at,
          updated_at: r.updated_at,
          last_login_at: lastLogin,
          last_change_at: lastChange,
          last_active_at: lastActive,
          vehicle_count: r.vehicle_count || 0,
          shared_vehicle_count: r.shared_vehicle_count || 0,
          is_dormant: isDormant,
        };
      });

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

  public static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!email || !email.includes('@')) {
        res.status(400).json({ error: 'Voer een geldig e-mailadres in' });
        return;
      }

      const user = db.get<any>('SELECT id, email FROM users WHERE LOWER(email) = ?', [email]);
      if (!user) {
        // Return generic success to prevent email enumeration
        res.json({
          success: true,
          message: 'Als dit e-mailadres bij ons bekend is, is er een herstellink verzonden.',
        });
        return;
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const id = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

      db.run(
        `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, user.id, tokenHash, expiresAt, now.toISOString()]
      );

      const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3084';
      const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
      const origin = req.headers.origin || `${proto}://${hostHeader}`;
      const resetLink = `${origin}/reset-password?token=${rawToken}`;

      const smtpConfigured = EmailService.isConfigured();
      let emailSent = false;
      let emailError: string | null = null;

      if (smtpConfigured) {
        const mailRes = await EmailService.sendPasswordResetEmail(user.email, resetLink);
        emailSent = mailRes.success;
        if (!mailRes.success) {
          emailError = mailRes.message;
        }
      }

      res.json({
        success: true,
        message: smtpConfigured && emailSent
          ? 'Er is een e-mail met een herstellink verzonden naar uw e-mailadres.'
          : 'Wachtwoordherstel geïnitieerd.',
        smtpConfigured,
        emailSent,
        resetLink: (!smtpConfigured || !emailSent || process.env.NODE_ENV === 'test') ? resetLink : undefined,
        errorDetails: emailError,
      });
    } catch (err: any) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Fout bij verwerken van wachtwoordherstel' });
    }
  }

  public static async verifyResetToken(req: Request, res: Response): Promise<void> {
    try {
      const rawToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
      if (!rawToken) {
        res.status(400).json({ error: 'Geen herstel-token opgegeven' });
        return;
      }

      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const now = new Date().toISOString();

      const record = db.get<any>(
        `SELECT pr.id, pr.expires_at, pr.used_at, u.email
         FROM password_resets pr
         JOIN users u ON pr.user_id = u.id
         WHERE pr.token_hash = ?`,
        [tokenHash]
      );

      if (!record || record.used_at || record.expires_at < now) {
        res.status(400).json({
          valid: false,
          error: !record
            ? 'Ongeldige herstellink'
            : record.used_at
            ? 'Deze herstellink is al eerder gebruikt.'
            : 'Deze herstellink is verlopen (geldig voor 1 uur). Vraag opnieuw een herstellink aan.',
        });
        return;
      }

      res.json({ valid: true, email: record.email });
    } catch (err: any) {
      console.error('Verify reset token error:', err);
      res.status(500).json({ error: 'Fout bij verifiëren van herstellink' });
    }
  }

  public static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body || {};
      if (!token || typeof token !== 'string') {
        res.status(400).json({ error: 'Geen geldig herstel-token meegegeven' });
        return;
      }

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        res.status(400).json({ error: 'Het nieuwe wachtwoord moet minimaal 6 tekens lang zijn' });
        return;
      }

      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
      const now = new Date().toISOString();

      const record = db.get<any>(
        `SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at, u.email
         FROM password_resets pr
         JOIN users u ON pr.user_id = u.id
         WHERE pr.token_hash = ?`,
        [tokenHash]
      );

      if (!record || record.used_at || record.expires_at < now) {
        res.status(400).json({
          error: !record
            ? 'Ongeldige herstellink.'
            : record.used_at
            ? 'Deze herstellink is al gebruikt.'
            : 'Deze herstellink is inmiddels verlopen. Vraag een nieuwe aan.',
        });
        return;
      }

      const hashedPassword = await hashPassword(newPassword);

      db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hashedPassword, now, record.user_id]);
      db.run('UPDATE password_resets SET used_at = ? WHERE id = ?', [now, record.id]);
      db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [record.user_id]);

      res.json({
        success: true,
        message: 'Uw wachtwoord is succesvol gewijzigd! U kunt nu inloggen met uw nieuwe wachtwoord.',
      });
    } catch (err: any) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Wachtwoord wijzigen mislukt' });
    }
  }

  public static async generateUserResetLink(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sendEmail = req.body?.sendEmail === true;

      const user = db.get<any>('SELECT id, email FROM users WHERE id = ?', [id]);
      if (!user) {
        res.status(404).json({ error: 'Gebruiker niet gevonden' });
        return;
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const resetId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

      db.run(
        `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [resetId, user.id, tokenHash, expiresAt, now.toISOString()]
      );

      const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3084';
      const proto = (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
      const origin = req.headers.origin || `${proto}://${hostHeader}`;
      const resetLink = `${origin}/reset-password?token=${rawToken}`;

      let emailSent = false;
      let emailMessage = '';
      if (sendEmail) {
        if (EmailService.isConfigured()) {
          const mailRes = await EmailService.sendPasswordResetEmail(user.email, resetLink);
          emailSent = mailRes.success;
          emailMessage = mailRes.message;
        } else {
          emailMessage = 'SMTP is niet geconfigureerd; e-mail kon niet worden verzonden.';
        }
      }

      res.json({
        success: true,
        resetLink,
        expiresAt,
        emailSent,
        emailMessage,
      });
    } catch (err: any) {
      console.error('Generate reset link error:', err);
      res.status(500).json({ error: 'Herstellink genereren mislukt' });
    }
  }
}
