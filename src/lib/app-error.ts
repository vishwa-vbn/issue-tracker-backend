import { ERROR_CODES, type ErrorCode } from '../constants/error-codes.js';

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    readonly details: unknown = null,
    message?: string,
  ) {
    super(message ?? ERROR_CODES[code].message);
    this.status = ERROR_CODES[code].status;
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
