import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';
import { env } from '../config/env.js';

const { Pool } = pg;

const isSslRequired =
  env.NODE_ENV === 'production' ||
  env.DATABASE_URL.includes('sslmode=require') ||
  env.DATABASE_URL.includes('neon.tech');

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  ssl: isSslRequired ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });
