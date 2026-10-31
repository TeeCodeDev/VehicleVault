import { env, DATA_PATHS } from './config/env.js';
import { initializeDatabase } from './db/schema.js';
import { createApp } from './app.js';

// Global process error handlers with clean logging
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] ❌ CRITICAL: Uncaught exception:`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] ❌ CRITICAL: Unhandled rejection at:`, promise, 'reason:', reason);
});

async function bootstrap() {
  const startTime = Date.now();
  const host = process.env.HOST || '0.0.0.0';
  const port = env.PORT;

  console.log(`====================================================`);
  console.log(`🚗 VehicleVault Server (v2.0.0)`);
  console.log(`====================================================`);
  console.log(`[${new Date().toISOString()}] [STARTUP] Node: ${process.version} | Platform: ${process.platform} (${process.arch})`);
  console.log(`[${new Date().toISOString()}] [STARTUP] Environment: ${env.NODE_ENV}`);
  console.log(`[${new Date().toISOString()}] [STARTUP] Persistent Data Path: ${DATA_PATHS.root}`);

  console.log(`[${new Date().toISOString()}] [DB] Initializing SQLite schema and migrations...`);
  initializeDatabase();
  console.log(`[${new Date().toISOString()}] [DB] SQLite database initialized successfully at: ${DATA_PATHS.db}`);

  console.log(`[${new Date().toISOString()}] [APP] Configuring Express routes and middleware...`);
  const app = createApp();

  const server = app.listen(port, host, () => {
    const elapsed = Date.now() - startTime;
    console.log(`====================================================`);
    console.log(`✅ VehicleVault Server is ready in ${elapsed}ms!`);
    console.log(`📡 URL:          http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    console.log(`🩺 Health check: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/healthz`);
    console.log(`🤖 MCP Endpoint: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/api/mcp`);
    console.log(`📂 Storage:      ${DATA_PATHS.root}`);
    console.log(`====================================================`);
  });

  // Graceful backward-compatibility listener for port 3001 (legacy Unraid templates)
  if (port !== 3001) {
    try {
      const fallbackServer = app.listen(3001, host, () => {
        console.log(`[STARTUP] 🔄 Legacy port 3001 fallback listener active (http://${host === '0.0.0.0' ? 'localhost' : host}:3001)`);
      });
      fallbackServer.on('error', () => {
        // Silently ignore if port 3001 is already bound
      });
    } catch {}
  }

  server.on('error', (err: any) => {
    console.error(`====================================================`);
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ FATAL: Port ${port} on ${host} is already in use by another process or container.`);
    } else if (err.code === 'EACCES') {
      console.error(`❌ FATAL: Permission denied to bind to port ${port} on ${host}.`);
    } else {
      console.error(`❌ FATAL: Failed to start HTTP server:`, err);
    }
    console.error(`====================================================`);
    process.exit(1);
  });

  const shutdown = (signal: string) => {
    console.log(`[${new Date().toISOString()}] [SHUTDOWN] Received ${signal}. Gracefully closing server...`);
    server.close(() => {
      console.log(`[${new Date().toISOString()}] [SHUTDOWN] VehicleVault server closed cleanly.`);
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error(`[${new Date().toISOString()}] ❌ Fatal initialization error:`, err);
  process.exit(1);
});
