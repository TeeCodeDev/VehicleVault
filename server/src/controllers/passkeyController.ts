import { Request, Response } from 'express';
import { z } from 'zod';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { db } from '../db/database.js';
import { isAuthDisabled } from '../middleware/auth.js';
import { PasskeyService, MAX_PASSKEYS_PER_USER, type PasskeyRow } from '../services/passkeyService.js';
import { classifyPasskeyOrigin, getRelyingParty, requestOrigin } from '../utils/passkeyHost.js';
import { startSession } from '../utils/session.js';

const RP_NAME = 'VehicleVault';

const labelSchema = z.string().trim().min(1, 'Geef de passkey een naam').max(50);

const registerVerifySchema = z.object({
  credential: z.object({ id: z.string().min(1), response: z.record(z.any()) }).passthrough(),
  label: labelSchema.optional(),
});

const loginVerifySchema = z.object({ id: z.string().min(1), response: z.record(z.any()) }).passthrough();

const redeemSchema = z.object({ code: z.string().min(1).max(64) });

// One message for every way a sign-in with a passkey or recovery code can fail.
const SIGN_IN_FAILED = 'Inloggen met passkey mislukt';
const RECOVERY_FAILED = 'Deze herstelcode is niet geldig';

function toUint8Array(b64url: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(b64url, 'base64url'));
}

function parseTransports(value: string | null): any[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Passkeys are managed by a signed-in person, not by an API key or when login is switched off. */
function sessionUserId(req: Request, res: Response): string | null {
  if (!req.user || req.user.isApiKey || isAuthDisabled()) {
    res.status(403).json({ error: 'Passkeys beheren kan alleen na inloggen met een account' });
    return null;
  }
  return req.user.userId;
}

function ensureAvailable(req: Request, res: Response): boolean {
  const availability = classifyPasskeyOrigin(requestOrigin(req));
  if (!availability.available) {
    res.status(400).json({ error: availability.reason });
    return false;
  }
  return true;
}

export class PasskeyController {
  // ── Managing passkeys (signed in) ───────────────────────────────────────────

  public static async list(req: Request, res: Response): Promise<void> {
    const userId = sessionUserId(req, res);
    if (!userId) return;
    res.json({
      passkeys: PasskeyService.listForUser(userId).map(PasskeyService.toPublic),
      recoveryCodesRemaining: PasskeyService.countRecoveryCodes(userId),
      hasPassword: PasskeyService.hasPassword(userId),
    });
  }

  public static async registerOptions(req: Request, res: Response): Promise<void> {
    try {
      const userId = sessionUserId(req, res);
      if (!userId || !ensureAvailable(req, res)) return;

      const user = db.get<{ id: string; email: string }>('SELECT id, email FROM users WHERE id = ?', [userId]);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const existing = PasskeyService.listForUser(userId);
      if (existing.length >= MAX_PASSKEYS_PER_USER) {
        res.status(400).json({ error: `Je kunt maximaal ${MAX_PASSKEYS_PER_USER} passkeys registreren` });
        return;
      }

      const { rpID } = getRelyingParty(req);
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID,
        userName: user.email,
        userID: new Uint8Array(Buffer.from(user.id, 'utf8')),
        attestationType: 'none',
        excludeCredentials: existing.map((p) => ({ id: p.id, transports: parseTransports(p.transports) })),
        // Discoverable credential + user verification, so the passkey can replace typing a password.
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      });

      PasskeyService.saveChallenge(options.challenge, 'register', userId);
      res.json(options);
    } catch (err: any) {
      console.error('Passkey registration options error:', err);
      res.status(500).json({ error: 'Passkey registreren mislukt door een serverfout' });
    }
  }

  public static async registerVerify(req: Request, res: Response): Promise<void> {
    try {
      const userId = sessionUserId(req, res);
      if (!userId || !ensureAvailable(req, res)) return;

      const parse = registerVerifySchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0].message });
        return;
      }

      const { rpID, origins } = getRelyingParty(req);
      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: parse.data.credential as unknown as RegistrationResponseJSON,
          expectedChallenge: (challenge) => PasskeyService.consumeChallenge(challenge, 'register', userId),
          expectedOrigin: origins,
          expectedRPID: rpID,
          requireUserVerification: true,
        });
      } catch (err: any) {
        console.warn('Passkey registration rejected:', err?.message);
        res.status(400).json({ error: 'Passkey registreren is mislukt of verlopen' });
        return;
      }

      if (!verification.verified || !verification.registrationInfo) {
        res.status(400).json({ error: 'Passkey registreren is mislukt of verlopen' });
        return;
      }

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      if (db.get('SELECT id FROM passkey_credentials WHERE id = ?', [credential.id])) {
        res.status(409).json({ error: 'Deze passkey is al geregistreerd' });
        return;
      }

      const label = parse.data.label || `Passkey ${PasskeyService.listForUser(userId).length + 1}`;
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO passkey_credentials
          (id, user_id, public_key, counter, transports, device_type, backed_up, label, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          credential.id,
          userId,
          Buffer.from(credential.publicKey).toString('base64url'),
          credential.counter,
          credential.transports ? JSON.stringify(credential.transports) : null,
          credentialDeviceType,
          credentialBackedUp ? 1 : 0,
          label,
          now,
        ]
      );

      // Someone who just added a passkey should leave with a way back in.
      const recoveryCodes = PasskeyService.countRecoveryCodes(userId) === 0 ? PasskeyService.replaceRecoveryCodes(userId) : undefined;

      const row = db.get<PasskeyRow>('SELECT * FROM passkey_credentials WHERE id = ?', [credential.id])!;
      res.status(201).json({ passkey: PasskeyService.toPublic(row), recoveryCodes });
    } catch (err: any) {
      console.error('Passkey registration verify error:', err);
      res.status(500).json({ error: 'Passkey registreren mislukt door een serverfout' });
    }
  }

  public static async rename(req: Request, res: Response): Promise<void> {
    const userId = sessionUserId(req, res);
    if (!userId) return;
    const parse = labelSchema.safeParse(req.body?.label);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0].message });
      return;
    }
    const result = db.run('UPDATE passkey_credentials SET label = ? WHERE id = ? AND user_id = ?', [
      parse.data,
      req.params.id,
      userId,
    ]);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Passkey niet gevonden' });
      return;
    }
    res.json({ success: true });
  }

  public static async remove(req: Request, res: Response): Promise<void> {
    const userId = sessionUserId(req, res);
    if (!userId) return;
    const owned = db.get('SELECT id FROM passkey_credentials WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    if (!owned) {
      res.status(404).json({ error: 'Passkey niet gevonden' });
      return;
    }
    if (!PasskeyService.canRemovePasskey(userId, req.params.id)) {
      res.status(400).json({ error: 'Dit is je enige manier om in te loggen. Voeg eerst een andere passkey toe.' });
      return;
    }
    db.run('DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    // Recovery codes only make sense next to a passkey.
    if (PasskeyService.listForUser(userId).length === 0) {
      db.run('DELETE FROM recovery_codes WHERE user_id = ?', [userId]);
    }
    res.json({ success: true });
  }

  public static async regenerateRecoveryCodes(req: Request, res: Response): Promise<void> {
    const userId = sessionUserId(req, res);
    if (!userId) return;
    if (PasskeyService.listForUser(userId).length === 0) {
      res.status(400).json({ error: 'Voeg eerst een passkey toe om herstelcodes te kunnen maken' });
      return;
    }
    res.json({ recoveryCodes: PasskeyService.replaceRecoveryCodes(userId) });
  }

  // ── Signing in (public) ─────────────────────────────────────────────────────

  public static async loginOptions(req: Request, res: Response): Promise<void> {
    try {
      if (!ensureAvailable(req, res)) return;
      const { rpID } = getRelyingParty(req);
      // No allowCredentials: the authenticator offers its discoverable passkeys, so no e-mail is needed.
      const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
      PasskeyService.saveChallenge(options.challenge, 'login', null);
      res.json(options);
    } catch (err: any) {
      console.error('Passkey login options error:', err);
      res.status(500).json({ error: SIGN_IN_FAILED });
    }
  }

  public static async loginVerify(req: Request, res: Response): Promise<void> {
    try {
      const parse = loginVerifySchema.safeParse(req.body);
      if (!parse.success) {
        res.status(401).json({ error: SIGN_IN_FAILED });
        return;
      }
      const response = parse.data as unknown as AuthenticationResponseJSON;

      const row = db.get<PasskeyRow & { email: string; role: string }>(
        `SELECT c.*, u.email, u.role
         FROM passkey_credentials c
         JOIN users u ON u.id = c.user_id
         WHERE c.id = ?`,
        [response.id]
      );
      if (!row) {
        res.status(401).json({ error: SIGN_IN_FAILED });
        return;
      }

      const { rpID, origins } = getRelyingParty(req);
      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge: (challenge) => PasskeyService.consumeChallenge(challenge, 'login', null),
          expectedOrigin: origins,
          expectedRPID: rpID,
          credential: {
            id: row.id,
            publicKey: toUint8Array(row.public_key),
            counter: row.counter,
            transports: parseTransports(row.transports),
          },
          requireUserVerification: true,
        });
      } catch (err: any) {
        console.warn('Passkey login rejected:', err?.message);
        res.status(401).json({ error: SIGN_IN_FAILED });
        return;
      }

      if (!verification.verified) {
        res.status(401).json({ error: SIGN_IN_FAILED });
        return;
      }

      const now = new Date().toISOString();
      db.run('UPDATE passkey_credentials SET counter = ?, backed_up = ?, last_used_at = ? WHERE id = ?', [
        verification.authenticationInfo.newCounter,
        verification.authenticationInfo.credentialBackedUp ? 1 : 0,
        now,
        row.id,
      ]);

      res.json(startSession(req, res, { id: row.user_id, email: row.email, role: row.role }, { trackLogin: true }));
    } catch (err: any) {
      console.error('Passkey login error:', err);
      res.status(500).json({ error: SIGN_IN_FAILED });
    }
  }

  public static async redeemRecoveryCode(req: Request, res: Response): Promise<void> {
    try {
      const parse = redeemSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(401).json({ error: RECOVERY_FAILED });
        return;
      }

      // The code is consumed first; whether the account still exists is checked afterwards.
      const userId = PasskeyService.redeemRecoveryCode(parse.data.code);
      const user = userId
        ? db.get<{ id: string; email: string; role: string }>('SELECT id, email, role FROM users WHERE id = ?', [userId])
        : undefined;
      if (!user) {
        res.status(401).json({ error: RECOVERY_FAILED });
        return;
      }

      res.json({
        ...startSession(req, res, user, { trackLogin: true }),
        recoveryCodesRemaining: PasskeyService.countRecoveryCodes(user.id),
      });
    } catch (err: any) {
      console.error('Recovery code redeem error:', err);
      res.status(401).json({ error: RECOVERY_FAILED });
    }
  }
}
