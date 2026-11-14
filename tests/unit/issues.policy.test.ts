import { describe, it, expect } from 'vitest';
import {
  canEditIssue,
  canDeleteIssue,
  canChangeStatus,
  canAssignIssue,
  isAdmin,
} from '../../src/modules/issues/issues.policy.js';
import type { AuthUser } from '../../src/types/auth.js';
import type { IssueRow } from '../../src/modules/issues/issues.types.js';

describe('Issues Policy', () => {
  const adminUser: AuthUser = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  const reporterUser: AuthUser = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Reporter User',
    email: 'reporter@example.com',
    role: 'USER',
  };

  const assigneeUser: AuthUser = {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Assignee User',
    email: 'assignee@example.com',
    role: 'USER',
  };

  const otherUser: AuthUser = {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Other User',
    email: 'other@example.com',
    role: 'USER',
  };

  const mockIssue: IssueRow = {
    id: '55555555-5555-5555-5555-555555555555',
    issueNumber: 1,
    title: 'Test Issue',
    description: 'Description',
    status: 'OPEN',
    priority: 'HIGH',
    reporterId: reporterUser.id,
    assigneeId: assigneeUser.id,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  describe('isAdmin', () => {
    it('returns true for admin user', () => {
      expect(isAdmin(adminUser)).toBe(true);
    });

    it('returns false for regular user', () => {
      expect(isAdmin(reporterUser)).toBe(false);
    });
  });

  describe('canEditIssue', () => {
    it.each([
      ['admin', adminUser, true],
      ['reporter', reporterUser, true],
      ['assignee', assigneeUser, false],
      ['other', otherUser, false],
    ])('evaluates correctly for %s', (_role, user, expected) => {
      expect(canEditIssue(user, mockIssue)).toBe(expected);
    });
  });

  describe('canDeleteIssue', () => {
    it.each([
      ['admin', adminUser, true],
      ['reporter', reporterUser, true],
      ['assignee', assigneeUser, false],
      ['other', otherUser, false],
    ])('evaluates correctly for %s', (_role, user, expected) => {
      expect(canDeleteIssue(user, mockIssue)).toBe(expected);
    });
  });

  describe('canChangeStatus', () => {
    it.each([
      ['admin', adminUser, true],
      ['reporter', reporterUser, true],
      ['assignee', assigneeUser, true],
      ['other', otherUser, false],
    ])('evaluates correctly for %s', (_role, user, expected) => {
      expect(canChangeStatus(user, mockIssue)).toBe(expected);
    });
  });

  describe('canAssignIssue', () => {
    it.each([
      ['admin', adminUser, true],
      ['reporter', reporterUser, true],
      ['assignee', assigneeUser, false],
      ['other', otherUser, false],
    ])('evaluates correctly for %s', (_role, user, expected) => {
      expect(canAssignIssue(user, mockIssue)).toBe(expected);
    });
  });
});

