import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export function getJwtSecret(): string {
  return env.JWT_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: TokenPayload, expiresIn?: string): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: (expiresIn || env.JWT_EXPIRES_IN || '30d') as any,
  });
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(days = 90): { token: string; hash: string; expiresAt: string } {
  const token = crypto.randomBytes(40).toString('hex');
  const hash = hashToken(token);
  const expires = new Date();
  expires.setDate(expires.getDate() + (env.JWT_REFRESH_EXPIRES_IN_DAYS || days));
  return {
    token,
    hash,
    expiresAt: expires.toISOString(),
  };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generate2FaTempToken(payload: { userId: string; email: string }): string {
  return jwt.sign({ ...payload, purpose: '2fa_login' }, getJwtSecret(), { expiresIn: '5m' });
}

export function verify2FaTempToken(token: string): { userId: string; email: string; purpose: string } | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    if (decoded && decoded.purpose === '2fa_login' && decoded.userId) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

export function generateApiKey(name: string): { rawKey: string; keyHash: string; prefix: string } {
  const randomPart = crypto.randomBytes(24).toString('hex');
  const rawKey = `vkv_${randomPart}`;
  const prefix = rawKey.substring(0, 8); // e.g. "vkv_1a2b"
  const keyHash = hashToken(rawKey);
  return { rawKey, keyHash, prefix };
}
