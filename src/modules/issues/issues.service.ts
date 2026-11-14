import { eq, and, or, ilike, isNull, sql, desc, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/client.js';
import { issues, users, comments, notDeleted } from '../../db/schema/index.js';
import { AppError } from '../../lib/app-error.js';
import { calculatePagination } from '../../lib/pagination.js';
import { escapeLike } from '../../lib/escape-like.js';
import { recordActivity } from './activity.service.js';
import { canEditIssue, canDeleteIssue, canChangeStatus, canAssignIssue } from './issues.policy.js';
import type { CreateIssueInput, UpdateIssueInput, ListIssuesQuery } from './issues.schemas.js';
import type { AuthUser } from '../../types/auth.js';
import type { IssueStatus, IssuePriority } from '../../constants/issue.js';

const reporters = alias(users, 'reporter');
const assignees = alias(users, 'assignee');

export const listIssues = async (_user: AuthUser, query: ListIssuesQuery) => {
  const conditions = [notDeleted(issues)];

  if (query.status) {
    conditions.push(eq(issues.status, query.status as IssueStatus));
  }
  if (query.priority) {
    conditions.push(eq(issues.priority, query.priority as IssuePriority));
  }
  if (query.assigneeId) {
    conditions.push(eq(issues.assigneeId, query.assigneeId));
  }
  if (query.reporterId) {
    conditions.push(eq(issues.reporterId, query.reporterId));
  }
  if (query.unassigned) {
    conditions.push(isNull(issues.assigneeId));
  }
  if (query.q && query.q.trim() !== '') {
    const pattern = `%${escapeLike(query.q.trim())}%`;
    conditions.push(or(ilike(issues.title, pattern), ilike(issues.description, pattern))!);
  }

  const whereClause = and(...conditions);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(issues)
    .where(whereClause);

  const total = countResult[0]?.count ?? 0;
  const { offset, limit, meta } = calculatePagination(query.page, query.limit, total);

  let sortColumn;
  switch (query.sort) {
    case 'updatedAt':
      sortColumn = issues.updatedAt;
      break;
    case 'priority':
      sortColumn = issues.priority;
      break;
    case 'status':
      sortColumn = issues.status;
      break;
    case 'createdAt':
    default:
      sortColumn = issues.createdAt;
      break;
  }

  const orderExpr = query.order === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = await db
    .select({
      id: issues.id,
      issueNumber: issues.issueNumber,
      title: issues.title,
      description: issues.description,
      status: issues.status,
      priority: issues.priority,
      closedAt: issues.closedAt,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
      reporter: {
        id: reporters.id,
        name: reporters.name,
        email: reporters.email,
      },
      assignee: {
        id: assignees.id,
        name: assignees.name,
        email: assignees.email,
      },
    })
    .from(issues)
    .innerJoin(reporters, eq(issues.reporterId, reporters.id))
    .leftJoin(assignees, eq(issues.assigneeId, assignees.id))
    .where(whereClause)
    .orderBy(orderExpr)
    .limit(limit)
    .offset(offset);

  return {
    rows,
    meta,
  };
};

export const getIssueById = async (id: string) => {
  const rows = await db
    .select({
      id: issues.id,
      issueNumber: issues.issueNumber,
      title: issues.title,
      description: issues.description,
      status: issues.status,
      priority: issues.priority,
      closedAt: issues.closedAt,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
      reporter: {
        id: reporters.id,
        name: reporters.name,
        email: reporters.email,
      },
      assignee: {
        id: assignees.id,
        name: assignees.name,
        email: assignees.email,
      },
    })
    .from(issues)
    .innerJoin(reporters, eq(issues.reporterId, reporters.id))
    .leftJoin(assignees, eq(issues.assigneeId, assignees.id))
    .where(and(eq(issues.id, id), notDeleted(issues)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new AppError('ISSUE_NOT_FOUND');
  }

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(and(eq(comments.issueId, id), notDeleted(comments)));

  return {
    id: row.id,
    issueNumber: row.issueNumber,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reporter: row.reporter,
    assignee: row.assignee,
    commentCount: countResult[0]?.count ?? 0,
  };
};

export const createIssue = async (user: AuthUser, input: CreateIssueInput) => {
  let assigneeUser: { id: string; name: string } | null = null;
  if (input.assigneeId) {
    const [foundAssignee] = await db
      .select({ id: users.id, name: users.name, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, input.assigneeId))
      .limit(1);

    if (!foundAssignee || !foundAssignee.isActive) {
      throw new AppError('ASSIGNEE_NOT_FOUND');
    }
    assigneeUser = { id: foundAssignee.id, name: foundAssignee.name };
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(issues)
      .values({
        title: input.title,
        description: input.description,
        priority: input.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        reporterId: user.id,
        assigneeId: input.assigneeId ?? null,
      })
      .returning();

    await recordActivity(tx, {
      issueId: created!.id,
      actorId: user.id,
      type: 'CREATED',
      to: created!.status,
    });

    if (assigneeUser) {
      await recordActivity(tx, {
        issueId: created!.id,
        actorId: user.id,
        type: 'ASSIGNED',
        to: assigneeUser.name,
      });
    }

    return {
      id: created!.id,
      issueNumber: created!.issueNumber,
      title: created!.title,
      description: created!.description,
      status: created!.status,
      priority: created!.priority,
      createdAt: created!.createdAt,
      reporter: {
        id: user.id,
        name: user.name,
      },
      assignee: assigneeUser ? { id: assigneeUser.id, name: assigneeUser.name } : null,
    };
  });
};

export const updateIssue = async (user: AuthUser, id: string, input: UpdateIssueInput) => {
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, id), notDeleted(issues)))
    .limit(1);

  if (!issue) {
    throw new AppError('ISSUE_NOT_FOUND');
  }

  if (!canEditIssue(user, issue)) {
    throw new AppError('FORBIDDEN');
  }

  return db.transaction(async (tx) => {
    const updateData: Partial<typeof issues.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.priority !== undefined) {
      updateData.priority = input.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }

    const [updated] = await tx.update(issues).set(updateData).where(eq(issues.id, id)).returning();

    await recordActivity(tx, {
      issueId: id,
      actorId: user.id,
      type: 'UPDATED',
    });

    return updated;
  });
};

export const changeStatus = async (user: AuthUser, id: string, nextStatus: IssueStatus) => {
  return db.transaction(async (tx) => {
    const [issue] = await tx
      .select()
      .from(issues)
      .where(and(eq(issues.id, id), notDeleted(issues)))
      .for('update')
      .limit(1);

    if (!issue) {
      throw new AppError('ISSUE_NOT_FOUND');
    }

    if (!canChangeStatus(user, issue)) {
      throw new AppError('FORBIDDEN');
    }

    if (issue.status === nextStatus) {
      throw new AppError('ISSUE_STATUS_UNCHANGED');
    }

    const [updated] = await tx
      .update(issues)
      .set({
        status: nextStatus,
        closedAt: nextStatus === 'CLOSED' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, id))
      .returning();

    await recordActivity(tx, {
      issueId: id,
      actorId: user.id,
      type: 'STATUS_CHANGED',
      from: issue.status,
      to: nextStatus,
    });

    return updated;
  });
};

export const assignIssue = async (user: AuthUser, id: string, assigneeId: string | null) => {
  return db.transaction(async (tx) => {
    const [issue] = await tx
      .select()
      .from(issues)
      .where(and(eq(issues.id, id), notDeleted(issues)))
      .for('update')
      .limit(1);

    if (!issue) {
      throw new AppError('ISSUE_NOT_FOUND');
    }

    if (!canAssignIssue(user, issue)) {
      throw new AppError('FORBIDDEN');
    }

    let assigneeName: string | null = null;
    if (assigneeId) {
      const [assigneeUser] = await tx.select().from(users).where(eq(users.id, assigneeId)).limit(1);

      if (!assigneeUser || !assigneeUser.isActive) {
        throw new AppError('ASSIGNEE_NOT_FOUND');
      }
      assigneeName = assigneeUser.name;
    }

    const [updated] = await tx
      .update(issues)
      .set({
        assigneeId,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, id))
      .returning();

    if (assigneeId && assigneeName) {
      await recordActivity(tx, {
        issueId: id,
        actorId: user.id,
        type: 'ASSIGNED',
        to: assigneeName,
      });
    } else {
      await recordActivity(tx, {
        issueId: id,
        actorId: user.id,
        type: 'UNASSIGNED',
      });
    }

    return updated;
  });
};

export const deleteIssue = async (user: AuthUser, id: string) => {
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, id), notDeleted(issues)))
    .limit(1);

  if (!issue) {
    throw new AppError('ISSUE_NOT_FOUND');
  }

  if (!canDeleteIssue(user, issue)) {
    throw new AppError('FORBIDDEN');
  }

  await db
    .update(issues)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(issues.id, id));
};
