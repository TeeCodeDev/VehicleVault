import crypto from 'node:crypto';
import { db } from '../db/database.js';
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from '../utils/recoveryCodes.js';

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MAX_PASSKEYS_PER_USER = 20;

const PLACEHOLDER_HASHES = new Set(['', 'proxy_auth_placeholder', 'disabled_auth_placeholder']);

export type ChallengePurpose = 'register' | 'login';

export interface PasskeyRow {
  id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  device_type: string | null;
  backed_up: number;
  label: string;
  created_at: string;
  last_used_at: string | null;
}

export class PasskeyService {
  // ── Challenges: short-lived and single use ──────────────────────────────────

  static saveChallenge(challenge: string, purpose: ChallengePurpose, userId: string | null): void {
    const now = Date.now();
    db.run('DELETE FROM auth_challenges WHERE expires_at < ?', [new Date(now).toISOString()]);
    db.run(
      'INSERT INTO auth_challenges (challenge, purpose, user_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      [
        challenge,
        purpose,
        userId,
        new Date(now + CHALLENGE_TTL_MS).toISOString(),
        new Date(now).toISOString(),
      ]
    );
  }

  /** Spend a challenge. Purpose and user are part of the query, not a check afterwards. */
  static consumeChallenge(challenge: string, purpose: ChallengePurpose, userId: string | null): boolean {
    const result = db.run(
      'DELETE FROM auth_challenges WHERE challenge = ? AND purpose = ? AND user_id IS ? AND expires_at >= ?',
      [challenge, purpose, userId, new Date().toISOString()]
    );
    return result.changes === 1;
  }

  // ── Credentials ─────────────────────────────────────────────────────────────

  static listForUser(userId: string): PasskeyRow[] {
    return db.query<PasskeyRow>('SELECT * FROM passkey_credentials WHERE user_id = ? ORDER BY created_at ASC', [userId]);
  }

  static toPublic(row: PasskeyRow) {
    return {
      id: row.id,
      label: row.label,
      deviceType: row.device_type,
      backedUp: row.backed_up === 1,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    };
  }

  /** A real password (not the placeholder written for proxy-provisioned or auth-disabled users). */
  static hasPassword(userId: string): boolean {
    const row = db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [userId]);
    return !!row && !PLACEHOLDER_HASHES.has(row.password_hash);
  }

  /** Can this user still sign in if the given passkey is removed? */
  static canRemovePasskey(userId: string, passkeyId: string): boolean {
    if (PasskeyService.hasPassword(userId)) return true;
    return PasskeyService.listForUser(userId).some((p) => p.id !== passkeyId);
  }

  // ── Recovery codes ──────────────────────────────────────────────────────────

  static countRecoveryCodes(userId: string): number {
    return db.get<{ count: number }>('SELECT COUNT(*) as count FROM recovery_codes WHERE user_id = ?', [userId])?.count || 0;
  }

  /** Replace all of a user's recovery codes. The plaintext is returned once and never stored. */
  static replaceRecoveryCodes(userId: string): string[] {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
    const now = new Date().toISOString();
    db.run('DELETE FROM recovery_codes WHERE user_id = ?', [userId]);
    for (const code of codes) {
      db.run('INSERT INTO recovery_codes (id, user_id, code_hash, created_at) VALUES (?, ?, ?, ?)', [
        crypto.randomUUID(),
        userId,
        hashRecoveryCode(normalizeRecoveryCode(code)!),
        now,
      ]);
    }
    return codes;
  }

  /**
   * Redeem a code: the row is deleted before anything else is looked at, so a code can never be
   * retried. Returns the owner's user id, or null for every kind of rejection.
   */
  static redeemRecoveryCode(input: unknown): string | null {
    const normalized = normalizeRecoveryCode(input);
    if (!normalized) return null;
    const hash = hashRecoveryCode(normalized);
    const row = db.get<{ user_id: string }>('SELECT user_id FROM recovery_codes WHERE code_hash = ?', [hash]);
    if (!row) return null;
    const result = db.run('DELETE FROM recovery_codes WHERE code_hash = ?', [hash]);
    return result.changes === 1 ? row.user_id : null;
  }
}
