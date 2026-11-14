import http from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pool } from './db/client.js';

const server = http.createServer(app);

server.listen(env.PORT, () => {
  logger.info(`Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
});

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Shutdown signal received. Starting graceful shutdown...');

  server.close(async () => {
    logger.info('HTTP server closed. Stopping database connections...');
    try {
      await pool.end();
      logger.info('Database pool closed. Process terminated cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during database pool shutdown');
      process.exit(1);
    }
  });

  // Force close after 10s if graceful shutdown times out
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
