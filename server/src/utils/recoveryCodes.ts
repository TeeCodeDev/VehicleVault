import crypto from 'node:crypto';
import { hashToken } from './token.js';

// No 0, O, 1 or I: they are the characters people misread off paper. 32 symbols = 5 bits each.
export const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RECOVERY_CODE_LENGTH = 16;
export const RECOVERY_CODE_COUNT = 8;

/** One code as shown to the user: XXXX-XXXX-XXXX-XXXX (80 bits of entropy). */
export function generateRecoveryCode(): string {
  let raw = '';
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    raw += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
  }
  return raw.match(/.{4}/g)!.join('-');
}

/**
 * Strip transcription noise (case, spaces, ASCII and typographic dashes). Look-alikes are not
 * mapped onto each other: someone typing a 0 misread the page, and a silent guess is worse than
 * a rejection. Returns null when the result cannot be a code, so the caller can skip the lookup.
 */
export function normalizeRecoveryCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 64) return null;
  const cleaned = input.toUpperCase().replace(/[\s\-‐-―−]/g, '');
  if (cleaned.length !== RECOVERY_CODE_LENGTH) return null;
  for (const ch of cleaned) {
    if (!RECOVERY_ALPHABET.includes(ch)) return null;
  }
  return cleaned;
}

export function hashRecoveryCode(normalized: string): string {
  return hashToken(normalized);
}
