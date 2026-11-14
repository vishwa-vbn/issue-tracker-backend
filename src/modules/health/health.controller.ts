import type { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { ok } from '../../lib/respond.js';
import { db } from '../../db/client.js';
import { AppError } from '../../lib/app-error.js';

export const ping = (_req: Request, res: Response) => {
  ok(res, 'Welcome to Issue Tracker Backend');
};

export const health = (_req: Request, res: Response) => {
  ok(res, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

export const ready = async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`SELECT 1`);
    ok(res, {
      status: 'ready',
      database: 'connected',
    });
  } catch (err) {
    throw new AppError('INTERNAL_ERROR', err, 'Database connection failed');
  }
};
