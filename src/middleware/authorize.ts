import type { RequestHandler } from 'express';
import type { UserRole } from '../constants/roles.js';
import { AppError } from '../lib/app-error.js';

export const requireRole = (...roles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError('FORBIDDEN');
    }
    next();
  };
};

