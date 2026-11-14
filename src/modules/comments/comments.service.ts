import { eq, and, sql, asc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { comments, issues, users, notDeleted } from '../../db/schema/index.js';
import { AppError } from '../../lib/app-error.js';
import { calculatePagination } from '../../lib/pagination.js';
import { canEditComment, canDeleteComment } from './comments.policy.js';
import { recordActivity } from '../issues/activity.service.js';
import type { AuthUser } from '../../types/auth.js';

export const listComments = async (issueId: string, page = 1, limit = 10) => {
  // Ensure parent issue exists and is not deleted
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.id, issueId), notDeleted(issues)))
    .limit(1);

  if (!issue) {
    throw new AppError('ISSUE_NOT_FOUND');
  }

  const whereClause = and(eq(comments.issueId, issueId), notDeleted(comments));

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(whereClause);

  const total = countResult[0]?.count ?? 0;
  const { offset, limit: safeLimit, meta } = calculatePagination(page, limit, total);

  const rows = await db
    .select({
      id: comments.id,
      issueId: comments.issueId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      author: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(whereClause)
    .orderBy(asc(comments.createdAt))
    .limit(safeLimit)
    .offset(offset);

  return {
    rows,
    meta,
  };
};

export const createComment = async (user: AuthUser, issueId: string, body: string) => {
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.id, issueId), notDeleted(issues)))
    .limit(1);

  if (!issue) {
    throw new AppError('ISSUE_NOT_FOUND');
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(comments)
      .values({
        issueId,
        authorId: user.id,
        body,
      })
      .returning();

    await recordActivity(tx, {
      issueId,
      actorId: user.id,
      type: 'COMMENTED',
    });

    return {
      id: created!.id,
      issueId: created!.issueId,
      body: created!.body,
      createdAt: created!.createdAt,
      updatedAt: created!.updatedAt,
      author: {
        id: user.id,
        name: user.name,
      },
    };
  });
};

export const updateComment = async (user: AuthUser, id: string, body: string) => {
  const [comment] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, id), notDeleted(comments)))
    .limit(1);

  if (!comment) {
    throw new AppError('COMMENT_NOT_FOUND');
  }

  if (!canEditComment(user, comment)) {
    throw new AppError('FORBIDDEN');
  }

  const [updated] = await db
    .update(comments)
    .set({
      body,
      updatedAt: new Date(),
    })
    .where(eq(comments.id, id))
    .returning();

  return {
    id: updated!.id,
    issueId: updated!.issueId,
    body: updated!.body,
    createdAt: updated!.createdAt,
    updatedAt: updated!.updatedAt,
    author: {
      id: user.id,
      name: user.name,
    },
  };
};

export const deleteComment = async (user: AuthUser, id: string) => {
  const [comment] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, id), notDeleted(comments)))
    .limit(1);

  if (!comment) {
    throw new AppError('COMMENT_NOT_FOUND');
  }

  if (!canDeleteComment(user, comment)) {
    throw new AppError('FORBIDDEN');
  }

  await db
    .update(comments)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(comments.id, id));
};
