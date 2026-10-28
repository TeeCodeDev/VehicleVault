import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file if available
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATA_DIR: z.string().default(process.env.DATA_DIR || (process.platform === 'win32' ? path.resolve('./data') : '/data')),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().default('vehiclevault_super_secret_jwt_key_change_in_production_12345'),
  JWT_REFRESH_SECRET: z.string().default('vehiclevault_super_secret_refresh_key_change_in_production_67890'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().default(7),
  CORS_ORIGIN: z.string().default('*'),
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

for (const p of [DATA_PATHS.root, DATA_PATHS.receipts, DATA_PATHS.invoices, DATA_PATHS.vehicles, DATA_PATHS.documents, DATA_PATHS.logs]) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

