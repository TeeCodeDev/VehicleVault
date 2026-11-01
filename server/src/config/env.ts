import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file if available
dotenv.config();

function getOrGenerateSecret(envVal: string | undefined, secretFileName: string): string {
  if (envVal && envVal.trim().length > 0) {
    return envVal.trim();
  }
  // Deterministic secret for automated tests
  if (process.env.NODE_ENV === 'test') {
    return 'vehiclevault_test_deterministic_secret_key_12345';
  }
  const dataDir = process.env.DATA_DIR && process.env.DATA_DIR.trim().length > 0
    ? process.env.DATA_DIR.trim()
    : (process.platform === 'win32' ? path.resolve('./data') : '/data');
  const secretPath = path.join(dataDir, secretFileName);
  try {
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const stringOrDefault = (defaultValue: string) =>
  z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : defaultValue));

const booleanOrDefault = (defaultValue: boolean) =>
  z
    .any()
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return defaultValue;
      const v = String(val).trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    });

const numberOrDefault = (defaultValue: number) =>
  z
    .any()
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return defaultValue;
      const parsed = parseInt(String(val), 10);
      return isNaN(parsed) || parsed <= 0 ? defaultValue : parsed;
    });

const envSchema = z.object({
  NODE_ENV: z
    .string()
    .optional()
    .transform((val) => {
      const v = (val || '').trim().toLowerCase();
      return ['development', 'production', 'test'].includes(v)
        ? (v as 'development' | 'production' | 'test')
        : 'production';
    }),
  PORT: numberOrDefault(3084),
  DATA_DIR: z
    .string()
    .optional()
    .transform((val) => {
      if (val && val.trim().length > 0) return val.trim();
      return process.platform === 'win32' ? path.resolve('./data') : '/data';
    }),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z
    .string()
    .optional()
    .transform((val) => getOrGenerateSecret(val, '.jwt_secret')),
  JWT_REFRESH_SECRET: z
    .string()
    .optional()
    .transform((val) => getOrGenerateSecret(val, '.jwt_refresh_secret')),
  JWT_EXPIRES_IN: stringOrDefault('30d'),
  JWT_REFRESH_EXPIRES_IN_DAYS: numberOrDefault(90),
  CORS_ORIGIN: stringOrDefault('*'),

  // Reverse proxy authentication hardening (default: FALSE for security!)
  TRUST_PROXY_HEADERS: z
    .any()
    .optional()
    .transform((val) => {
      const primary = val !== undefined && val !== null ? String(val).trim().toLowerCase() : undefined;
      const legacy = process.env.ENABLE_PROXY_AUTH || process.env.PROXY_AUTH;
      const effective = primary !== undefined ? primary : (legacy || '').trim().toLowerCase();
      return effective === 'true' || effective === '1' || effective === 'yes';
    }),
  TRUSTED_PROXIES: z
    .string()
    .optional()
    .transform((val) => {
      const raw = val || process.env.TRUSTED_PROXY_IPS || '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7';
      return raw.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
    }),
  ALLOW_PROXY_REGISTRATION: booleanOrDefault(true),

  // Authentication bypass (strictly opt-in, default: FALSE)
  DISABLE_AUTH: z
    .any()
    .optional()
    .transform((val) => {
      const primary = val !== undefined && val !== null ? String(val).trim().toLowerCase() : undefined;
      const legacy = (process.env.AUTH_DISABLED || '').trim().toLowerCase();
      const effective = primary !== undefined ? primary : legacy;
      return effective === 'true' || effective === '1' || effective === 'yes';
    }),

  // WebAuthn / passkeys relying party. Both optional: without them the request host/origin is used.
  RP_ID: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim().toLowerCase() : undefined)),
  RP_ORIGINS: z
    .string()
    .optional()
    .transform((val) =>
      (val || '')
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
        .filter((o) => o.length > 0)
    ),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;

// Ensure persistent directories exist
export const DATA_PATHS = {
  root: env.DATA_DIR,
  db: path.join(env.DATA_DIR, 'vehiclevault.db'),
  receipts: path.join(env.DATA_DIR, 'receipts'),
  invoices: path.join(env.DATA_DIR, 'invoices'),
  vehicles: path.join(env.DATA_DIR, 'vehicles'),
  documents: path.join(env.DATA_DIR, 'documents'),
  logs: path.join(env.DATA_DIR, 'logs'),
};

for (const p of [
  DATA_PATHS.root,
  DATA_PATHS.receipts,
  DATA_PATHS.invoices,
  DATA_PATHS.vehicles,
  DATA_PATHS.documents,
  DATA_PATHS.logs,
]) {
  try {
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  } catch (err: any) {
    console.error(`[STORAGE] Warning: Could not create persistent path "${p}": ${err?.message}`);
  }
}
