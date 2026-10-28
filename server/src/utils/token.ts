import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): { token: string; hash: string; expiresAt: string } {
  const token = crypto.randomBytes(40).toString('hex');
  const hash = hashToken(token);
  const expires = new Date();
  expires.setDate(expires.getDate() + env.JWT_REFRESH_EXPIRES_IN_DAYS);
  return {
    token,
    hash,
    expiresAt: expires.toISOString(),
  };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateApiKey(name: string): { rawKey: string; keyHash: string; prefix: string } {
  const randomPart = crypto.randomBytes(24).toString('hex');
  const rawKey = `vkv_${randomPart}`;
  const prefix = rawKey.substring(0, 8); // e.g. "vkv_1a2b"
  const keyHash = hashToken(rawKey);
  return { rawKey, keyHash, prefix };
}

