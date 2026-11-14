import type { AuthUser } from '../../types/auth.js';
import type { IssueRow } from './issues.types.js';

export const isAdmin = (user: AuthUser): boolean => user.role === 'ADMIN';

export const canEditIssue = (user: AuthUser, issue: IssueRow): boolean => {
  return isAdmin(user) || issue.reporterId === user.id;
};

export const canDeleteIssue = (user: AuthUser, issue: IssueRow): boolean => {
  return isAdmin(user) || issue.reporterId === user.id;
};

export const canChangeStatus = (user: AuthUser, issue: IssueRow): boolean => {
  return isAdmin(user) || issue.reporterId === user.id || issue.assigneeId === user.id;
};

export const canAssignIssue = (user: AuthUser, issue: IssueRow): boolean => {
  return isAdmin(user) || issue.reporterId === user.id;
};

