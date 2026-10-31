import crypto from 'node:crypto';
import { getJwtSecret } from './token.js';

/**
 * Encrypts what the app has to keep but must never show again (the sign-in tokens of Microsoft 365 and Google).
 * AES-256-GCM with a key derived from JWT_SECRET: a copy of the database alone does not give the tokens away.
 * Changing JWT_SECRET makes them unreadable, and the app then asks to sign in again.
 */
const PREFIX = 'v1';

function key(): Buffer {
  return crypto.scryptSync(getJwtSecret(), 'vehiclevault:mail-token:v1', 32);
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [PREFIX, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

/** The plain text, or undefined when the value is not ours, was altered, or the key has changed. */
export function unseal(sealed: string | undefined | null): string | undefined {
  if (!sealed) return undefined;
  const [prefix, iv, tag, data] = sealed.split('.');
  if (prefix !== PREFIX || !iv || !tag || !data) return undefined;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return undefined;
  }
}
