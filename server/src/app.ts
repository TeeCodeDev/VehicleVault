import path from 'node:path';
import fs from 'node:fs';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { env, DATA_PATHS } from './config/env.js';
import { db } from './db/database.js';
import { apiLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/authRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import fuelRoutes from './routes/fuelRoutes.js';
import maintenanceRoutes from './routes/maintenanceRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import importRoutes from './routes/importRoutes.js';
import mcpRoutes from './routes/mcpRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import haRoutes from './routes/haRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import backupRoutes from './routes/backupRoutes.js';

export function createApp(): express.Application {
  const app = express();

  // Trust reverse proxies and Docker gateway hops for accurate IP detection
  app.set('trust proxy', 1);

  // Security headers configured for self-hosted LAN / HTTP / HTTPS setups
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: false,
      originAgentCluster: false,
    })
  );

  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Serve persistent uploads securely
  app.use('/uploads/receipts', express.static(DATA_PATHS.receipts));
  app.use('/uploads/invoices', express.static(DATA_PATHS.invoices));
  app.use('/uploads/vehicles', express.static(DATA_PATHS.vehicles));
  app.use('/uploads/documents', express.static(DATA_PATHS.documents));

  // Health check endpoint (Phase 4 requirement)
  app.get('/healthz', (_req: Request, res: Response) => {
    try {
      const dbCheck = db.get('SELECT 1 as healthy');
      res.json({
        status: 'healthy',
        database: dbCheck?.healthy === 1 ? 'connected' : 'unhealthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: '1.0.19',
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'unhealthy',
        error: err?.message,
      });
    }
  });

  // Apply general rate limiter to API routes
  app.use('/api', apiLimiter);

  // Mount API Domain Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/vehicles', vehicleRoutes);
  app.use('/api/fuel', fuelRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/mcp', mcpRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/integrations/ha', haRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/backup', backupRoutes);

  // Serve static client PWA in production or unified container
  const possiblePaths = [
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), '../client/dist'),
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../client/dist'),
    '/app/client/dist',
  ];
  const clientDist = possiblePaths.find((p) => fs.existsSync(p));

  if (clientDist) {
    app.use(express.static(clientDist));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });

  return app;
}
