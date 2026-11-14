import { eq, ne, and, or, ilike, sql, desc, asc, isNull } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { users, issues, refreshTokens, notDeleted } from '../../db/schema/index.js';
import { AppError } from '../../lib/app-error.js';
import { calculatePagination } from '../../lib/pagination.js';
import { escapeLike } from '../../lib/escape-like.js';
import { hashPassword } from '../../lib/password.js';
import type { AuthUser } from '../../types/auth.js';
import type { CreateUserInput, UpdateUserInput, ListUsersQuery } from './users.schemas.js';

export const getAssignableUsers = async () => {
  const activeUsers = await db
    .select({
      id: users.id,
      name: users.name,
    })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.name));

  return activeUsers;
};

export const listUsers = async (query: ListUsersQuery) => {
  const conditions = [];

  if (query.role) {
    conditions.push(eq(users.role, query.role as 'USER' | 'ADMIN'));
  }
  if (query.isActive !== undefined) {
    conditions.push(eq(users.isActive, query.isActive));
  }
  if (query.q && query.q.trim() !== '') {
    const pattern = `%${escapeLike(query.q.trim())}%`;
    conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(whereClause);

  const total = countResult[0]?.count ?? 0;
  const { offset, limit, meta } = calculatePagination(query.page, query.limit, total);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    rows,
    meta,
  };
};

export const getUserById = async (targetId: string) => {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (!user) {
    throw new AppError('USER_NOT_FOUND');
  }

  // Count reported and assigned issues for this user
  const reportedResult = await db
    .select({ reportedCount: sql<number>`count(*)::int` })
    .from(issues)
    .where(and(eq(issues.reporterId, targetId), notDeleted(issues)));

  const assignedResult = await db
    .select({ assignedCount: sql<number>`count(*)::int` })
    .from(issues)
    .where(and(eq(issues.assigneeId, targetId), notDeleted(issues)));

  return {
    ...user,
    stats: {
      reportedIssues: reportedResult[0]?.reportedCount ?? 0,
      assignedIssues: assignedResult[0]?.assignedCount ?? 0,
    },
  };
};

export const createUser = async (input: CreateUserInput) => {
  const email = input.email.toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    throw new AppError('USER_EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(input.password);

  const [createdUser] = await db
    .insert(users)
    .values({
      name: input.name,
      email,
      passwordHash,
      role: (input.role as 'USER' | 'ADMIN') ?? 'USER',
      isActive: input.isActive ?? true,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  return createdUser;
};

export const updateUser = async (
  actingUser: AuthUser,
  targetId: string,
  input: UpdateUserInput,
) => {
  return db.transaction(async (tx) => {
    const [targetUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, targetId))
      .for('update')
      .limit(1);

    if (!targetUser) {
      throw new AppError('USER_NOT_FOUND');
    }

    // Guard 1: Cannot demote or deactivate self
    const isDemotingSelf = input.role !== undefined && input.role !== 'ADMIN';
    const isDeactivatingSelf = input.isActive === false;
    if (actingUser.id === targetId && (isDemotingSelf || isDeactivatingSelf)) {
      throw new AppError('USER_SELF_MODIFY');
    }

    // Guard 2: Cannot demote or deactivate the last active admin
    const targetIsActiveAdmin = targetUser.role === 'ADMIN' && targetUser.isActive;
    const willNoLongerBeActiveAdmin =
      (input.role !== undefined && input.role !== 'ADMIN') || input.isActive === false;

    if (targetIsActiveAdmin && willNoLongerBeActiveAdmin) {
      const countResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true)));

      if ((countResult[0]?.count ?? 0) <= 1) {
        throw new AppError('USER_LAST_ADMIN');
      }
    }

    // Check email uniqueness if email is being updated
    if (input.email) {
      const normalizedEmail = input.email.toLowerCase();
      if (normalizedEmail !== targetUser.email.toLowerCase()) {
        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, normalizedEmail), ne(users.id, targetId)))
          .limit(1);

        if (existing) {
          throw new AppError('USER_EMAIL_TAKEN');
        }
      }
    }

    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.email !== undefined) {
      updateData.email = input.email.toLowerCase();
    }
    if (input.role !== undefined) {
      updateData.role = input.role as 'USER' | 'ADMIN';
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }
    if (input.password !== undefined) {
      updateData.passwordHash = await hashPassword(input.password);
    }

    // If deactivated, revoke all active refresh tokens immediately
    if (input.isActive === false) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, targetId), isNull(refreshTokens.revokedAt)));
    }

    const [updated] = await tx
      .update(users)
      .set(updateData)
      .where(eq(users.id, targetId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return updated;
  });
};

export const deleteUser = async (actingUser: AuthUser, targetId: string) => {
  return db.transaction(async (tx) => {
    const [targetUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, targetId))
      .for('update')
      .limit(1);

    if (!targetUser) {
      throw new AppError('USER_NOT_FOUND');
    }

    // Guard 1: Cannot delete self
    if (actingUser.id === targetId) {
      throw new AppError('USER_SELF_MODIFY');
    }

    // Guard 2: Cannot delete last active admin
    if (targetUser.role === 'ADMIN' && targetUser.isActive) {
      const countResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true)));

      if ((countResult[0]?.count ?? 0) <= 1) {
        throw new AppError('USER_LAST_ADMIN');
      }
    }

    // Deactivate user and revoke all sessions
    await tx
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetId));

    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, targetId), isNull(refreshTokens.revokedAt)));
  });
};
