import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestId } from './middleware/request-id.js';
import { globalLimiter, authLimiter } from './middleware/rate-limit.js';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';

import healthRouter from './modules/health/health.routes.js';
import authRouter from './modules/auth/auth.routes.js';
import usersRouter from './modules/users/users.routes.js';
import issuesRouter from './modules/issues/issues.routes.js';
import commentsRouter from './modules/comments/comments.routes.js';
import dashboardRouter from './modules/dashboard/dashboard.routes.js';

const app = express();

app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.disable('x-powered-by');

app.use(requestId);

if (env.NODE_ENV !== 'test') {
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id ?? '',
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );
}

app.use(helmet());

const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) {
        return callback(null, true);
      }
      // If CORS_ORIGINS is '*' or contains '*', reflect origin (compatible with credentials: true)
      if (allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      // If origin is in allowedOrigins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Allow any Vercel deployment (e.g. *.vercel.app) or localhost
      if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      // Allow remote origins
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept', 'Origin'],
    exposedHeaders: ['Set-Cookie', 'X-Request-Id'],
  }),
);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(globalLimiter);

// API v1 Routes
app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/issues', issuesRouter);
app.use('/api/v1', commentsRouter);
app.use('/api/v1/dashboard', dashboardRouter);

// 404 and Error Handler
app.use(notFound);
app.use(errorHandler);

export default app;

