import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { AppError } from '../lib/app-error.js';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import type { UserRole } from '../constants/roles.js';

interface JwtPayload {
  sub: string;
  role: UserRole;
  iss: string;
  aud: string;
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('AUTH_TOKEN_MISSING');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new AppError('AUTH_TOKEN_MISSING');
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('AUTH_TOKEN_EXPIRED');
    }
    throw new AppError('AUTH_TOKEN_INVALID');
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);

  if (!user) {
    throw new AppError('AUTH_TOKEN_INVALID');
  }

  if (!user.isActive) {
    throw new AppError('AUTH_ACCOUNT_DISABLED');
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  next();
};
