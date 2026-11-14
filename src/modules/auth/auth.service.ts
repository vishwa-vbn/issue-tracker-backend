import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { users } from '../../db/schema/index.js';
import { AppError } from '../../lib/app-error.js';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../../lib/password.js';
import * as tokenService from './token.service.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';
import type { AuthUser } from '../../types/auth.js';

export const register = async (input: RegisterInput) => {
  const email = input.email.toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    throw new AppError('USER_EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(input.password);

  const [createdUser] = await db
    .insert(users)
    .values({
      name: input.name,
      email,
      passwordHash,
      role: 'USER',
      isActive: true,
    })
    .returning();

  const authUser: AuthUser = {
    id: createdUser!.id,
    name: createdUser!.name,
    email: createdUser!.email,
    role: createdUser!.role,
  };

  const accessToken = tokenService.signAccessToken(authUser);
  const rawRefreshToken = await tokenService.issueRefreshToken(authUser.id);

  return {
    user: authUser,
    accessToken,
    rawRefreshToken,
  };
};

export const login = async (input: LoginInput) => {
  const email = input.email.toLowerCase();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const isPasswordValid = await verifyPassword(
    input.password,
    user ? user.passwordHash : DUMMY_HASH,
  );

  if (!user || !isPasswordValid) {
    throw new AppError('AUTH_INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('AUTH_ACCOUNT_DISABLED');
  }

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = tokenService.signAccessToken(authUser);
  const rawRefreshToken = await tokenService.issueRefreshToken(authUser.id);

  return {
    user: authUser,
    accessToken,
    rawRefreshToken,
  };
};

export const adminLogin = async (input: LoginInput) => {
  const email = input.email.toLowerCase();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const isPasswordValid = await verifyPassword(
    input.password,
    user ? user.passwordHash : DUMMY_HASH,
  );

  if (!user || !isPasswordValid || user.role !== 'ADMIN') {
    throw new AppError('AUTH_INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('AUTH_ACCOUNT_DISABLED');
  }

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = tokenService.signAccessToken(authUser);
  const rawRefreshToken = await tokenService.issueRefreshToken(authUser.id);

  return {
    user: authUser,
    accessToken,
    rawRefreshToken,
  };
};

export const refresh = async (refreshToken?: string) => {
  if (!refreshToken) {
    throw new AppError('AUTH_REFRESH_INVALID');
  }

  const { userId, newRawToken } = await tokenService.rotateRefreshToken(refreshToken);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user || !user.isActive) {
    throw new AppError('AUTH_ACCOUNT_DISABLED');
  }

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = tokenService.signAccessToken(authUser);

  return {
    user: authUser,
    accessToken,
    newRawToken,
  };
};

export const logout = async (refreshToken?: string) => {
  if (refreshToken) {
    await tokenService.revokeRefreshToken(refreshToken);
  }
};

export const getMe = async (userId: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new AppError('USER_NOT_FOUND');
  }

  if (!user.isActive) {
    throw new AppError('AUTH_ACCOUNT_DISABLED');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
};

