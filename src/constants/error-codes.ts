export const ERROR_CODES = {
  VALIDATION_ERROR: { status: 400, message: 'Validation failed' },
  AUTH_INVALID_CREDENTIALS: { status: 401, message: 'Invalid email or password' },
  AUTH_TOKEN_MISSING: { status: 401, message: 'Authorization token missing' },
  AUTH_TOKEN_EXPIRED: { status: 401, message: 'Authorization token expired' },
  AUTH_TOKEN_INVALID: { status: 401, message: 'Invalid authorization token' },
  AUTH_REFRESH_INVALID: { status: 401, message: 'Invalid or expired refresh token' },
  AUTH_REFRESH_REUSED: { status: 401, message: 'Refresh token reuse detected; session revoked' },
  AUTH_ACCOUNT_DISABLED: { status: 403, message: 'Your account has been deactivated' },
  FORBIDDEN: { status: 403, message: 'You are not allowed to perform this action' },
  USER_NOT_FOUND: { status: 404, message: 'User not found' },
  USER_EMAIL_TAKEN: { status: 409, message: 'An account with this email already exists' },
  USER_LAST_ADMIN: { status: 409, message: 'Cannot demote or deactivate the last active admin' },
  USER_SELF_MODIFY: { status: 409, message: 'You cannot demote or deactivate your own account' },
  ISSUE_NOT_FOUND: { status: 404, message: 'Issue not found' },
  ISSUE_STATUS_UNCHANGED: {
    status: 409,
    message: 'Requested status is already the current status',
  },
  ASSIGNEE_NOT_FOUND: { status: 404, message: 'Assignee not found or is deactivated' },
  COMMENT_NOT_FOUND: { status: 404, message: 'Comment not found' },
  RATE_LIMITED: { status: 429, message: 'Too many requests, please try again later' },
  ROUTE_NOT_FOUND: { status: 404, message: 'Route not found' },
  INTERNAL_ERROR: { status: 500, message: 'An unexpected internal error occurred' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
