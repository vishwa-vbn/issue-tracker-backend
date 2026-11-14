import type { AuthUser } from '../../types/auth.js';
import type { CommentRow } from '../../db/schema/comments.js';

export const canEditComment = (user: AuthUser, comment: CommentRow): boolean => {
  return comment.authorId === user.id;
};

export const canDeleteComment = (user: AuthUser, comment: CommentRow): boolean => {
  return user.role === 'ADMIN' || comment.authorId === user.id;
};

