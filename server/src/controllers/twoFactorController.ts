import { Request, Response } from 'express';
import { db } from '../db/database.js';
import {
  generateTotpSecret,
  verifyTotpCode,
  generateOtpAuthUrl,
  generateQrCodeDataUrl,
  generateBackupCodes,
  hashBackupCode,
} from '../utils/totp.js';
import { verify2FaTempToken, comparePassword } from '../utils/token.js';
import { startSession } from '../utils/session.js';

export class TwoFactorController {
  /**
   * Get 2FA status for the logged in user
   */
  public static async status(req: Request, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Niet ingelogd' });
      return;
    }

    const user = db.get<any>(
      'SELECT two_factor_enabled, two_factor_backup_codes FROM users WHERE id = ?',
      [userId]
    );

    let backupCodesCount = 0;
    if (user?.two_factor_backup_codes) {
      try {
        const codes = JSON.parse(user.two_factor_backup_codes);
        backupCodesCount = Array.isArray(codes) ? codes.length : 0;
      } catch {
        backupCodesCount = 0;
      }
    }

    res.json({
      enabled: Boolean(user?.two_factor_enabled),
      backupCodesCount,
    });
  }

  /**
   * Start 2FA setup: generate secret, QR code, and backup codes
   */
  public static async setup(req: Request, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Niet ingelogd' });
      return;
    }

    const user = db.get<any>('SELECT email FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ error: 'Gebruiker niet gevonden' });
      return;
    }

    const secret = generateTotpSecret();
    const backupCodes = generateBackupCodes(8);
    const hashedBackupCodes = backupCodes.map((c) => hashBackupCode(c));
    const otpauthUrl = generateOtpAuthUrl(user.email, secret, 'VehicleVault');
    const qrCodeUrl = await generateQrCodeDataUrl(otpauthUrl);

    // Save pending setup in system_settings with 15 min TTL
    const cacheKey = `2fa_pending_${userId}`;
    const payload = JSON.stringify({
      secret,
      hashedBackupCodes,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    db.run(
      'INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)',
      [cacheKey, payload, new Date().toISOString()]
    );

    res.json({
      secret,
      qrCodeUrl,
      otpauthUrl,
      backupCodes,
    });
  }

  /**
   * Confirm and enable 2FA with a valid TOTP code
   */
  public static async enable(req: Request, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { code } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Niet ingelogd' });
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: '6-cijferige verificatiecode is verplicht' });
      return;
    }

    const cacheKey = `2fa_pending_${userId}`;
    const pendingRow = db.get<{ value: string }>(
      'SELECT value FROM system_settings WHERE key = ?',
      [cacheKey]
    );

    if (!pendingRow) {
      res.status(400).json({ error: 'Geen actieve 2FA installatiesessie gevonden. Start opnieuw.' });
      return;
    }

    let pending: { secret: string; hashedBackupCodes: string[]; expiresAt: number };
    try {
      pending = JSON.parse(pendingRow.value);
    } catch {
      res.status(400).json({ error: 'Ongeldige sessiedata' });
      return;
    }

    if (Date.now() > pending.expiresAt) {
      db.run('DELETE FROM system_settings WHERE key = ?', [cacheKey]);
      res.status(400).json({ error: 'Sessie verlopen. Start de 2FA installatie opnieuw.' });
      return;
    }

    const isValid = verifyTotpCode(pending.secret, code);
    if (!isValid) {
      res.status(400).json({
        error: 'Ongeldige code. Controleer of de tijd op je telefoon juist is ingesteld en probeer het opnieuw.',
      });
      return;
    }

    // Enable 2FA for user
    db.run(
      `UPDATE users 
       SET two_factor_enabled = 1,
           two_factor_secret = ?,
           two_factor_backup_codes = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        pending.secret,
        JSON.stringify(pending.hashedBackupCodes),
        new Date().toISOString(),
        userId,
      ]
    );

    db.run('DELETE FROM system_settings WHERE key = ?', [cacheKey]);

    res.json({
      success: true,
      message: 'Tweefactorauthenticatie (2FA) is succesvol ingeschakeld!',
    });
  }

  /**
   * Disable 2FA
   */
  public static async disable(req: Request, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { password, code } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Niet ingelogd' });
      return;
    }

    const user = db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ error: 'Gebruiker niet gevonden' });
      return;
    }

    let isAuthorized = false;
    if (password && (await comparePassword(password, user.password_hash))) {
      isAuthorized = true;
    } else if (code && user.two_factor_secret && verifyTotpCode(user.two_factor_secret, code)) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      res.status(400).json({
        error: 'Bevestiging mislukt. Voer je huidige wachtwoord of een geldige 2FA-code in.',
      });
      return;
    }

    db.run(
      `UPDATE users 
       SET two_factor_enabled = 0,
           two_factor_secret = NULL,
           two_factor_backup_codes = NULL,
           updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), userId]
    );

    res.json({
      success: true,
      message: 'Tweefactorauthenticatie (2FA) is uitgeschakeld.',
    });
  }

  /**
   * Regenerate backup codes
   */
  public static async regenerateBackupCodes(req: Request, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const { password, code } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Niet ingelogd' });
      return;
    }

    const user = db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user || !user.two_factor_enabled) {
      res.status(400).json({ error: '2FA is niet ingeschakeld' });
      return;
    }

    let isAuthorized = false;
    if (password && (await comparePassword(password, user.password_hash))) {
      isAuthorized = true;
    } else if (code && user.two_factor_secret && verifyTotpCode(user.two_factor_secret, code)) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      res.status(400).json({
        error: 'Bevestiging mislukt. Voer je huidige wachtwoord of een geldige 2FA-code in.',
      });
      return;
    }

    const backupCodes = generateBackupCodes(8);
    const hashedBackupCodes = backupCodes.map((c) => hashBackupCode(c));

    db.run(
      'UPDATE users SET two_factor_backup_codes = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(hashedBackupCodes), new Date().toISOString(), userId]
    );

    res.json({
      backupCodes,
      message: 'Nieuwe herstelcodes succesvol gegenereerd.',
    });
  }

  /**
   * Step 2 of Login: verify TOTP code or emergency backup code
   */
  public static async verifyLogin(req: Request, res: Response): Promise<void> {
    try {
      const { tempToken, code } = req.body;

      if (!tempToken || !code) {
        res.status(400).json({ error: 'Tijdelijke sessietoken en verificatiecode zijn verplicht' });
        return;
      }

      const decoded = verify2FaTempToken(tempToken);
      if (!decoded) {
        res.status(401).json({
          error: 'Verificatiesessie is verlopen of ongeldig. Log opnieuw in met je e-mail en wachtwoord.',
        });
        return;
      }

      const user = db.get<any>('SELECT * FROM users WHERE id = ?', [decoded.userId]);
      if (!user) {
        res.status(404).json({ error: 'Gebruiker niet gevonden' });
        return;
      }

      if (!user.two_factor_enabled || !user.two_factor_secret) {
        // User has no 2FA configured
        res.json(startSession(req, res, user, { trackLogin: true }));
        return;
      }

      const cleanCode = String(code).trim();
      let codeValid = false;
      let usedBackupCode = false;

      // 1. Try TOTP 6-digit code
      if (/^\d{6}$/.test(cleanCode)) {
        codeValid = verifyTotpCode(user.two_factor_secret, cleanCode);
      }

      // 2. If not valid, check backup recovery code (format XXXX-XXXX or 8 hex)
      if (!codeValid && user.two_factor_backup_codes) {
        try {
          const storedHashes: string[] = JSON.parse(user.two_factor_backup_codes);
          const inputHash = hashBackupCode(cleanCode);
          const idx = storedHashes.indexOf(inputHash);

          if (idx !== -1) {
            codeValid = true;
            usedBackupCode = true;
            // Consume the backup code
            storedHashes.splice(idx, 1);
            db.run(
              'UPDATE users SET two_factor_backup_codes = ?, updated_at = ? WHERE id = ?',
              [JSON.stringify(storedHashes), new Date().toISOString(), user.id]
            );
          }
        } catch {}
      }

      if (!codeValid) {
        res.status(401).json({ error: 'Ongeldige verificatiecode of herstelcode' });
        return;
      }

      const session = startSession(req, res, user, { trackLogin: true });
      res.json({
        ...session,
        usedBackupCode,
      });
    } catch (err: any) {
      console.error('2FA login verification error:', err);
      res.status(500).json({ error: err?.message || 'Serverfout tijdens 2FA verificatie' });
    }
  }
}

