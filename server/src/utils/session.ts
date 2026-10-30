import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { generateAccessToken, generateRefreshToken } from './token.js';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export function isSecureRequest(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

/**
 * Issue the app session for a user who has just proved who they are (password, passkey or
 * recovery code): a JWT access token in the body and the refresh token in an HttpOnly cookie.
 */
export function startSession(
  req: Request,
  res: Response,
  user: SessionUser,
  options: { trackLogin?: boolean } = {}
): { accessToken: string; user: SessionUser } {
  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
  const { token: refreshToken, hash: refreshHash, expiresAt } = generateRefreshToken();
  const now = new Date().toISOString();

  db.run(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [crypto.randomUUID(), user.id, refreshHash, expiresAt, now]
  );

  if (options.trackLogin) {
    db.run('UPDATE users SET last_login_at = ?, last_active_at = ? WHERE id = ?', [now, now, user.id]);
  }

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    maxAge: 90 * 24 * 60 * 60 * 1000,
  });

  return { accessToken, user: { id: user.id, email: user.email, role: user.role } };
}
