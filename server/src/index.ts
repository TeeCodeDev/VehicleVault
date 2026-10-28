import { env } from './config/env.js';
import { initializeDatabase } from './db/schema.js';
import { createApp } from './app.js';

// Global process error handlers to prevent unexpected termination
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught exception caught by process handler:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled rejection at:', promise, 'reason:', reason);
});

async function bootstrap() {
  console.log('Initializing VehicleVault Database (SQLite)...');
  initializeDatabase();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`====================================================`);
    console.log(`🚗 VehicleVault Server is running`);
    console.log(`📡 URL: http://localhost:${env.PORT}`);
    console.log(`🩺 Health check: http://localhost:${env.PORT}/healthz`);
    console.log(`🤖 MCP Endpoint: http://localhost:${env.PORT}/api/mcp`);
    console.log(`📂 Persistent Storage: ${env.DATA_DIR}`);
    console.log(`====================================================`);
  });

  const shutdown = () => {
    console.log('Received shutdown signal. Gracefully closing server...');
    server.close(() => {
      console.log('VehicleVault server closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
