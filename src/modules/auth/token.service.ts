import { randomBytes, createHash } from 'node:crypto';
import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq, and, isNull } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { refreshTokens, users } from '../../db/schema/index.js';
import { AppError } from '../../lib/app-error.js';
import type { AuthUser } from '../../types/auth.js';

export const hashToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex');
};

export const generateRawToken = (): string => {
  return randomBytes(32).toString('base64url');
};

export const signAccessToken = (user: AuthUser): string => {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      algorithm: 'HS256',
    },
  );
};

export const issueRefreshToken = async (userId: string): Promise<string> => {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return rawToken;
};

export const rotateRefreshToken = async (
  rawToken: string,
): Promise<{ userId: string; newRawToken: string }> => {
  const tokenHash = hashToken(rawToken);

  return db.transaction(async (tx) => {
    const [tokenRecord] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!tokenRecord) {
      throw new AppError('AUTH_REFRESH_INVALID');
    }

    // Reuse detection: if the token was already revoked, revoke all tokens for this user!
    if (tokenRecord.revokedAt !== null) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, tokenRecord.userId), isNull(refreshTokens.revokedAt)));
      throw new AppError('AUTH_REFRESH_REUSED');
    }

    // Check expiry
    if (tokenRecord.expiresAt < new Date()) {
      throw new AppError('AUTH_REFRESH_INVALID');
    }

    // Check user status
    const [user] = await tx.select().from(users).where(eq(users.id, tokenRecord.userId)).limit(1);

    if (!user || !user.isActive) {
      throw new AppError('AUTH_ACCOUNT_DISABLED');
    }

    // Issue new token and link rotation
    const newRawToken = generateRawToken();
    const newTokenHash = hashToken(newRawToken);
    const newExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    const [newTokenRecord] = await tx
      .insert(refreshTokens)
      .values({
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      })
      .returning();

    await tx
      .update(refreshTokens)
      .set({
        revokedAt: new Date(),
        replacedBy: newTokenRecord!.id,
      })
      .where(eq(refreshTokens.id, tokenRecord.id));

    return {
      userId: user.id,
      newRawToken,
    };
  });
};

export const revokeRefreshToken = async (rawToken: string): Promise<void> => {
  const tokenHash = hashToken(rawToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, tokenHash));
};

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
  });
};
