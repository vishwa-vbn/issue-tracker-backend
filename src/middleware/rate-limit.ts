import { rateLimit, type Options } from 'express-rate-limit';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../lib/app-error.js';

const rateLimitFn = rateLimit as unknown as (options?: Partial<Options>) => RequestHandler;

export const globalLimiter: RequestHandler = rateLimitFn({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, _res: Response, next: NextFunction): void => {
    next(new AppError('RATE_LIMITED'));
  },
});

export const authLimiter: RequestHandler = rateLimitFn({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, _res: Response, next: NextFunction): void => {
    next(new AppError('RATE_LIMITED'));
  },
});
