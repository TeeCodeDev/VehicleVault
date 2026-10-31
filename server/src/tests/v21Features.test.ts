import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCode,
  generateOtpAuthUrl,
} from '../utils/totp.js';
import { generate2FaTempToken, verify2FaTempToken } from '../utils/token.js';
import { computeVignetteStatus } from '../controllers/vignetteController.js';
import { OidcController } from '../controllers/oidcController.js';
import { db } from '../db/database.js';
import { initializeDatabase } from '../db/schema.js';

describe('VehicleVault v2.1 Advanced Security & Vignette Engine', () => {
  before(() => {
    initializeDatabase();
  });
  it('should correctly generate and verify RFC 6238 TOTP codes', () => {
    const secret = generateTotpSecret(20);
    assert.ok(secret.length >= 32, 'Secret should be base32 encoded string');

    const currentStep = Math.floor(Date.now() / 1000 / 30);
    const validCode = generateTotpCode(secret, currentStep);
    assert.strictEqual(validCode.length, 6, 'TOTP code must be 6 digits');

    // Verify valid code
    const isValid = verifyTotpCode(secret, validCode, 1);
    assert.strictEqual(isValid, true, 'Valid TOTP code must pass verification');

    // Verify code in previous or next step (within window)
    const prevCode = generateTotpCode(secret, currentStep - 1);
    assert.strictEqual(verifyTotpCode(secret, prevCode, 1), true, 'Previous 30s step should pass within window');

    // Verify invalid code
    assert.strictEqual(verifyTotpCode(secret, '000000', 1), false, 'Incorrect code should fail');
    assert.strictEqual(verifyTotpCode(secret, 'abc', 1), false, 'Malformed code should fail');
  });

  it('should generate valid backup codes and verify single-use hashes', () => {
    const codes = generateBackupCodes(8);
    assert.strictEqual(codes.length, 8);
    codes.forEach((c) => {
      assert.match(c, /^[A-F0-9]{4}-[A-F0-9]{4}$/);
    });

    const hash1 = hashBackupCode(codes[0]);
    const hash2 = hashBackupCode(codes[0].toLowerCase());
    assert.strictEqual(hash1, hash2, 'Hash should be case-insensitive');
    assert.notStrictEqual(hash1, hashBackupCode(codes[1]), 'Different codes have different hashes');
  });

  it('should generate and verify 2FA temporary login token', () => {
    const tempToken = generate2FaTempToken({ userId: 'user-123', email: 'test@example.com' });
    assert.ok(tempToken.length > 20);

    const decoded = verify2FaTempToken(tempToken);
    assert.ok(decoded);
    assert.strictEqual(decoded.userId, 'user-123');
    assert.strictEqual(decoded.purpose, '2fa_login');

    assert.strictEqual(verify2FaTempToken('invalid-jwt-token'), null);
  });

  it('should correctly calculate vignette status (active, expiring_soon, expired, lifetime)', () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Lifetime vignette (no expiry date, e.g. German/French Crit'Air sticker)
    const lifetime = computeVignetteStatus(null, null);
    assert.strictEqual(lifetime.status, 'lifetime');
    assert.strictEqual(lifetime.daysRemaining, null);

    // Active vignette (valid for 60 more days)
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 60);
    const active = computeVignetteStatus(toYmd(today), toYmd(futureDate));
    assert.strictEqual(active.status, 'active');
    assert.ok((active.daysRemaining || 0) >= 59);

    // Expiring soon vignette (valid for 10 more days)
    const expiringDate = new Date();
    expiringDate.setDate(today.getDate() + 10);
    const expiring = computeVignetteStatus(toYmd(today), toYmd(expiringDate));
    assert.strictEqual(expiring.status, 'expiring_soon');

    // Expired vignette (expired 5 days ago)
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 5);
    const expired = computeVignetteStatus(toYmd(new Date(2020, 0, 1)), toYmd(pastDate));
    assert.strictEqual(expired.status, 'expired');
    assert.ok((expired.daysRemaining || 0) < 0);
  });

  it('should resolve OIDC configuration defaults and redirect URI properly', () => {
    const cfg = OidcController.getResolvedConfig();
    assert.ok(typeof cfg.enabled === 'boolean');
    assert.ok(typeof cfg.buttonLabel === 'string');
    assert.ok(cfg.scopes.includes('openid'));
  });

  it('should allow updating document date, name, and notes', () => {
    const userId = 'test-u-' + Date.now();
    const vehicleId = 'test-veh-' + Date.now();
    const docId = 'test-doc-' + Date.now();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, 'hash', 'admin', ?, ?)`,
      [userId, 'docuser-' + Date.now() + '@example.com', now, now]
    );

    db.run(
      `INSERT INTO vehicles (id, user_id, name, type, license_plate, initial_odometer, created_at, updated_at)
       VALUES (?, ?, 'Kia Niro', 'car', 'AA-11-BB', 50000, ?, ?)`,
      [vehicleId, userId, now, now]
    );

    db.run(
      `INSERT INTO vehicle_documents (id, vehicle_id, user_id, name, category, file_path, file_size, mime_type, document_date, created_at)
       VALUES (?, ?, ?, 'Aankoonota AndereAuto', 'invoice', 'dummy.pdf', 1024, 'application/pdf', '2026-10-30', ?)`,
      [docId, vehicleId, userId, now]
    );

    db.run(
      `UPDATE vehicle_documents
       SET name = ?, category = ?, document_date = ?, notes = ?
       WHERE id = ?`,
      ['Aankoopnota AndereAuto', 'invoice', '2026-10-16', 'Gekocht op 16 oktober', docId]
    );

    const updated = db.get<any>('SELECT * FROM vehicle_documents WHERE id = ?', [docId]);
    assert.strictEqual(updated.name, 'Aankoopnota AndereAuto');
    assert.strictEqual(updated.document_date, '2026-10-16');
    assert.strictEqual(updated.notes, 'Gekocht op 16 oktober');

    // Clean up
    db.run('DELETE FROM vehicle_documents WHERE id = ?', [docId]);
    db.run('DELETE FROM vehicles WHERE id = ?', [vehicleId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
  });
});

