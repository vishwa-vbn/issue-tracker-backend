import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['USER', 'ADMIN']);

export const issueStatusEnum = pgEnum('issue_status', ['OPEN', 'IN_PROGRESS', 'CLOSED']);

export const issuePriorityEnum = pgEnum('issue_priority', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const activityTypeEnum = pgEnum('activity_type', [
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'UNASSIGNED',
  'COMMENTED',
]);
