import crypto from 'node:crypto';
import QRCode from 'qrcode';

// Base32 RFC 4648 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/[\s-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleanInput[i]);
    if (val === -1) continue; // skip invalid chars

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate a new random base32 secret for TOTP (160 bits = 20 bytes = 32 base32 chars)
 */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

/**
 * Generate 6-digit TOTP code for a specific counter step
 */
export function generateTotpCode(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify a 6-digit TOTP code against a secret with +/- window drift
 */
export function verifyTotpCode(secretBase32: string, token: string, window = 1): boolean {
  if (!secretBase32 || !token) return false;
  const cleanToken = token.trim().replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;

  const currentStep = Math.floor(Date.now() / 1000 / 30);

  for (let error = -window; error <= window; error++) {
    const expected = generateTotpCode(secretBase32, currentStep + error);
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}

/**
 * Create standard otpauth:// URL
 */
export function generateOtpAuthUrl(email: string, secretBase32: string, issuer = 'VehicleVault'): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate QR code data URL (PNG Base64) for otpauth URL
 */
export async function generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

/**
 * Generate emergency backup recovery codes (e.g. 8 codes formatted as XXXX-XXXX)
 */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return codes;
}

/**
 * Hash a backup code for secure storage (SHA-256)
 */
export function hashBackupCode(code: string): string {
  const clean = code.trim().toUpperCase().replace(/[^A-F0-9]/g, '');
  return crypto.createHash('sha256').update(clean).digest('hex');
}

