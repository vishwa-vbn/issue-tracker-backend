import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';
import { logger } from '../config/logger.js';

export async function runMigrations() {
  const migrationsFolder = path.resolve(process.cwd(), 'src/db/migrations');
  logger.info({ migrationsFolder }, 'Running database migrations...');
  try {
    await migrate(db, { migrationsFolder });
    logger.info('Database migrations applied successfully.');
  } catch (err) {
    logger.error({ err }, 'Failed to apply database migrations');
    throw err;
  }
}

// When executed directly via `tsx src/db/migrate.ts` or `node dist/db/migrate.js`
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async () => {
      await pool.end();
      process.exit(1);
    });
}

