export const ISSUE_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED',
} as const;

export type IssueStatus = (typeof ISSUE_STATUS)[keyof typeof ISSUE_STATUS];

export const ISSUE_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export type IssuePriority = (typeof ISSUE_PRIORITY)[keyof typeof ISSUE_PRIORITY];

export const ACTIVITY_TYPE = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  ASSIGNED: 'ASSIGNED',
  UNASSIGNED: 'UNASSIGNED',
  COMMENTED: 'COMMENTED',
} as const;

export type ActivityType = (typeof ACTIVITY_TYPE)[keyof typeof ACTIVITY_TYPE];
