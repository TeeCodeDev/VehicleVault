import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file if available
dotenv.config();

const stringOrDefault = (defaultValue: string) =>
  z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : defaultValue));

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
  JWT_SECRET: stringOrDefault('vehiclevault_super_secret_jwt_key_change_in_production_12345'),
  JWT_REFRESH_SECRET: stringOrDefault('vehiclevault_super_secret_refresh_key_change_in_production_67890'),
  JWT_EXPIRES_IN: stringOrDefault('30d'),
  JWT_REFRESH_EXPIRES_IN_DAYS: numberOrDefault(90),
  CORS_ORIGIN: stringOrDefault('*'),
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
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}
