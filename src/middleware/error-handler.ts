import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { AppError } from '../lib/app-error.js';
import { ERROR_CODES, type ErrorCode } from '../constants/error-codes.js';
import { logger } from '../config/logger.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let code: ErrorCode = 'INTERNAL_ERROR';
  let message: string = ERROR_CODES.INTERNAL_ERROR.message;
  let details: unknown = null;

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = ERROR_CODES.VALIDATION_ERROR.status;
    code = 'VALIDATION_ERROR';
    message = ERROR_CODES.VALIDATION_ERROR.message;
    details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err instanceof jwt.TokenExpiredError) {
    status = ERROR_CODES.AUTH_TOKEN_EXPIRED.status;
    code = 'AUTH_TOKEN_EXPIRED';
    message = ERROR_CODES.AUTH_TOKEN_EXPIRED.message;
  } else if (err instanceof jwt.JsonWebTokenError) {
    status = ERROR_CODES.AUTH_TOKEN_INVALID.status;
    code = 'AUTH_TOKEN_INVALID';
    message = ERROR_CODES.AUTH_TOKEN_INVALID.message;
  } else if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
    status = ERROR_CODES.USER_EMAIL_TAKEN.status;
    code = 'USER_EMAIL_TAKEN';
    message = ERROR_CODES.USER_EMAIL_TAKEN.message;
  } else if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Malformed JSON in request body';
  } else {
    logger.error(
      {
        requestId: req.id,
        route: `${req.method} ${req.originalUrl || req.url}`,
        err,
      },
      'Unhandled internal error',
    );
  }

  // If a 4xx error occurred, we log debug/warn
  if (status >= 400 && status < 500) {
    logger.debug(
      {
        requestId: req.id,
        route: `${req.method} ${req.originalUrl || req.url}`,
        code,
        message,
        details,
      },
      'Client request error',
    );
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details: details ?? null,
    },
    requestId: req.id,
  });
};
