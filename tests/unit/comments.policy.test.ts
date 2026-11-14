import { describe, it, expect } from 'vitest';
import {
  canEditComment,
  canDeleteComment,
} from '../../src/modules/comments/comments.policy.js';
import type { AuthUser } from '../../src/types/auth.js';
import type { CommentRow } from '../../src/db/schema/comments.js';

describe('Comments Policy', () => {
  const adminUser: AuthUser = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  const authorUser: AuthUser = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Author User',
    email: 'author@example.com',
    role: 'USER',
  };

  const otherUser: AuthUser = {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Other User',
    email: 'other@example.com',
    role: 'USER',
  };

  const mockComment: CommentRow = {
    id: '44444444-4444-4444-4444-444444444444',
    issueId: '55555555-5555-5555-5555-555555555555',
    authorId: authorUser.id,
    body: 'Test comment body',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  describe('canEditComment', () => {
    it.each([
      ['author', authorUser, true],
      ['admin', adminUser, false],
      ['other', otherUser, false],
    ])('evaluates correctly for %s (author only)', (_role, user, expected) => {
      expect(canEditComment(user, mockComment)).toBe(expected);
    });
  });

  describe('canDeleteComment', () => {
    it.each([
      ['author', authorUser, true],
      ['admin', adminUser, true],
      ['other', otherUser, false],
    ])('evaluates correctly for %s (author or admin)', (_role, user, expected) => {
      expect(canDeleteComment(user, mockComment)).toBe(expected);
    });
  });
});

