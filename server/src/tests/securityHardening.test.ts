import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { db } from '../db/database.js';
import { initializeDatabase } from '../db/schema.js';
import { env } from '../config/env.js';
import {
  requireAuth,
  isProxyAuthEnabled,
  getProxyUser,
  isTrustedProxy,
  authenticateApiKey,
  getDefaultUser,
} from '../middleware/auth.js';
import { requireFileAuth } from '../middleware/fileAuth.js';
import { hashToken, generateAccessToken } from '../utils/token.js';

function mockRes() {
  const res: any = { statusCode: 200, body: null, cookies: {} as Record<string, string> };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: unknown) => {
    res.body = data;
    return res;
  };
  return res;
}

function mockReq(extra: Record<string, unknown> = {}) {
  return {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ip: '127.0.0.1',
    cookies: {},
    query: {},
    path: '',
    method: 'GET',
    ...extra,
  } as any;
}

describe('Master-Engineer Security Hardening & Vulnerability Remediation', () => {
  before(() => {
    initializeDatabase();
  });

  describe('OWASP A07: Reverse Proxy Header Spoofing Protection', () => {
    it('isProxyAuthEnabled() must be FALSE by default (no spoofable open headers)', () => {
      delete process.env.TRUST_PROXY_HEADERS;
      delete process.env.ENABLE_PROXY_AUTH;
      db.run('DELETE FROM system_settings WHERE key = ?', ['enable_proxy_auth']);

      assert.equal(isProxyAuthEnabled(), false, 'Proxy auth must default to false for security');
    });

    it('rejects spoofed proxy headers when proxy auth is disabled', () => {
      delete process.env.TRUST_PROXY_HEADERS;
      delete process.env.ENABLE_PROXY_AUTH;
      db.run('DELETE FROM system_settings WHERE key = ?', ['enable_proxy_auth']);

      const req = mockReq({
        headers: {
          'remote-email': 'admin@victim.com',
        },
      });

      const user = getProxyUser(req);
      assert.equal(user, null, 'Must ignore remote-email headers when proxy auth is disabled');
    });

    it('rejects proxy headers from untrusted upstream IPs even if proxy auth is enabled', () => {
      process.env.TRUST_PROXY_HEADERS = 'true';
      const untrustedReq = mockReq({
        socket: { remoteAddress: '203.0.113.195' }, // Public internet IP
        ip: '203.0.113.195',
        headers: {
          'remote-email': 'admin@victim.com',
        },
      });

      assert.equal(isTrustedProxy(untrustedReq), false);
      const user = getProxyUser(untrustedReq);
      assert.equal(user, null, 'Must reject proxy headers arriving from public untrusted IP');
      delete process.env.TRUST_PROXY_HEADERS;
    });

    it('accepts proxy headers ONLY from trusted upstream (loopback / private subnet) when explicitly enabled', () => {
      process.env.TRUST_PROXY_HEADERS = 'true';
      const trustedReq = mockReq({
        socket: { remoteAddress: '127.0.0.1' },
        ip: '127.0.0.1',
        headers: {
          'remote-email': 'trusted-proxy-user@example.com',
        },
      });

      assert.equal(isTrustedProxy(trustedReq), true);
      const user = getProxyUser(trustedReq);
      assert.ok(user);
      assert.equal(user.email, 'trusted-proxy-user@example.com');
      delete process.env.TRUST_PROXY_HEADERS;

      // Clean up auto-provisioned test user
      db.run('DELETE FROM users WHERE email = ?', ['trusted-proxy-user@example.com']);
    });
  });

  describe('OWASP A01: Private Upload File Access Control (requireFileAuth)', () => {
    const ownerId = crypto.randomUUID();
    const strangerId = crypto.randomUUID();
    const vehicleId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    const docFileName = `confidential-invoice-${Date.now()}.pdf`;

    before(() => {
      const now = new Date().toISOString();
      db.run('INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
        ownerId,
        `owner-${Date.now()}@test.local`,
        'hash',
        'user',
        now,
        now,
      ]);
      db.run('INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
        strangerId,
        `stranger-${Date.now()}@test.local`,
        'hash',
        'user',
        now,
        now,
      ]);
      db.run(
        'INSERT INTO vehicles (id, user_id, name, type, license_plate, initial_odometer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [vehicleId, ownerId, 'Test Vehicle', 'car', 'SEC-01', 1000, now, now]
      );
      db.run(
        'INSERT INTO vehicle_documents (id, vehicle_id, user_id, name, category, file_path, file_size, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [docId, vehicleId, ownerId, 'Aankoopfactuur', 'invoice', docFileName, 1024, 'application/pdf', now]
      );
    });

    after(() => {
      db.run('DELETE FROM vehicle_documents WHERE id = ?', [docId]);
      db.run('DELETE FROM vehicles WHERE id = ?', [vehicleId]);
      db.run('DELETE FROM users WHERE id IN (?, ?)', [ownerId, strangerId]);
    });

    it('rejects unauthenticated requests to private documents with 401', () => {
      const middleware = requireFileAuth('documents');
      const req = mockReq({ path: `/${docFileName}` });
      const res = mockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, 'Unauthenticated file request must not call next()');
      assert.equal(res.statusCode, 401);
    });

    it('rejects authenticated users who do NOT have permission for the vehicle with 403', () => {
      const middleware = requireFileAuth('documents');
      const strangerToken = generateAccessToken({ userId: strangerId, email: 'stranger@test.local', role: 'user' });
      const req = mockReq({
        path: `/${docFileName}`,
        headers: { authorization: `Bearer ${strangerToken}` },
      });
      const res = mockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403, 'Unauthorized vehicle access must return 403 Forbidden');
    });

    it('allows vehicle owner to stream their private document', () => {
      const middleware = requireFileAuth('documents');
      const ownerToken = generateAccessToken({ userId: ownerId, email: 'owner@test.local', role: 'user' });
      const req = mockReq({
        path: `/${docFileName}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      const res = mockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, 'Vehicle owner must be permitted to view their document');
      assert.equal(res.statusCode, 200);
    });

    it('allows access via session cookie (refresh_token)', () => {
      const middleware = requireFileAuth('documents');
      const rawRefreshToken = crypto.randomBytes(32).toString('hex');
      const refreshHash = hashToken(rawRefreshToken);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 86400000).toISOString();

      db.run(
        'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), ownerId, refreshHash, expiresAt, now.toISOString()]
      );

      const req = mockReq({
        path: `/${docFileName}`,
        cookies: { refresh_token: rawRefreshToken },
      });
      const res = mockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, 'User with valid session cookie must be authorized');
      db.run('DELETE FROM refresh_tokens WHERE token_hash = ?', [refreshHash]);
    });
  });

  describe('Unified API Key Authentication (authenticateApiKey)', () => {
    const testUserId = crypto.randomUUID();
    const rawApiKey = `vkv_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = hashToken(rawApiKey);

    before(() => {
      const now = new Date().toISOString();
      db.run('INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
        testUserId,
        `apikey-user-${Date.now()}@test.local`,
        'hash',
        'admin',
        now,
        now,
      ]);
      db.run(
        'INSERT INTO api_keys (id, user_id, name, key_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), testUserId, 'Home Assistant Test Key', keyHash, rawApiKey.substring(0, 8), now]
      );
    });

    after(() => {
      db.run('DELETE FROM api_keys WHERE user_id = ?', [testUserId]);
      db.run('DELETE FROM users WHERE id = ?', [testUserId]);
    });

    it('successfully authenticates a valid vkv_ API key', () => {
      const authUser = authenticateApiKey(rawApiKey);
      assert.ok(authUser);
      assert.equal(authUser.userId, testUserId);
      assert.equal(authUser.isApiKey, true);
    });

    it('rejects an invalid or tampered vkv_ API key', () => {
      const authUser = authenticateApiKey('vkv_invalid_fake_key_1234567890');
      assert.equal(authUser, null);
    });
  });
});

