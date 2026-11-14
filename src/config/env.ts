import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default(process.env.VERCEL ? 'production' : 'development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY_HOPS: z.coerce.number().default(process.env.VERCEL ? 1 : 0),

  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  DB_POOL_MAX: z.coerce.number().default(5),

  JWT_ACCESS_SECRET: z.string().min(32, 'use at least 32 random characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_ISSUER: z.string().default('issue-tracker-api'),
  JWT_AUDIENCE: z.string().default('issue-tracker-web'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  BCRYPT_ROUNDS: z.coerce.number().min(10).default(12),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),

  ADMIN_NAME: z.string().default('System Admin'),
  ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_PASSWORD: z.string().min(8).default('ChangeMe123'),
  SEED_DEMO_DATA: z
    .union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')])
    .default(false),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
