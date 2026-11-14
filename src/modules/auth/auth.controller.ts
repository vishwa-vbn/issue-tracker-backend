import type { Request, Response } from 'express';
import * as authService from './auth.service.js';
import * as tokenService from './token.service.js';
import { ok, created, noContent } from '../../lib/respond.js';

export const register = async (req: Request, res: Response) => {
  const { user, accessToken, rawRefreshToken } = await authService.register(req.body);
  tokenService.setRefreshCookie(res, rawRefreshToken);
  created(res, { user, accessToken });
};

export const login = async (req: Request, res: Response) => {
  const { user, accessToken, rawRefreshToken } = await authService.login(req.body);
  tokenService.setRefreshCookie(res, rawRefreshToken);
  ok(res, { user, accessToken });
};

export const adminLogin = async (req: Request, res: Response) => {
  const { user, accessToken, rawRefreshToken } = await authService.adminLogin(req.body);
  tokenService.setRefreshCookie(res, rawRefreshToken);
  ok(res, { user, accessToken });
};

export const refresh = async (req: Request, res: Response) => {
  const rawToken = req.cookies?.refresh_token as string | undefined;
  const { user, accessToken, newRawToken } = await authService.refresh(rawToken);
  tokenService.setRefreshCookie(res, newRawToken);
  ok(res, { user, accessToken });
};

export const logout = async (req: Request, res: Response) => {
  const rawToken = req.cookies?.refresh_token as string | undefined;
  await authService.logout(rawToken);
  tokenService.clearRefreshCookie(res);
  noContent(res);
};

export const me = async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  ok(res, { user });
};

