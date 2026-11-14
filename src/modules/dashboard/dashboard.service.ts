import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/client.js';
import { issues, users, notDeleted } from '../../db/schema/index.js';
import type { AuthUser } from '../../types/auth.js';

const reporters = alias(users, 'dashboard_reporters');
const assignees = alias(users, 'dashboard_assignees');

export const getDashboardSummary = async (user: AuthUser) => {
  // 1. Status totals via grouped query
  const statusRows = await db
    .select({
      status: issues.status,
      count: sql<number>`count(*)::int`,
    })
    .from(issues)
    .where(notDeleted(issues))
    .groupBy(issues.status);

  const totals = {
    all: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
  };

  for (const row of statusRows) {
    const c = row.count;
    totals.all += c;
    if (row.status === 'OPEN') totals.open = c;
    else if (row.status === 'IN_PROGRESS') totals.inProgress = c;
    else if (row.status === 'CLOSED') totals.closed = c;
  }

  // 2. Priority counts via grouped query
  const priorityRows = await db
    .select({
      priority: issues.priority,
      count: sql<number>`count(*)::int`,
    })
    .from(issues)
    .where(notDeleted(issues))
    .groupBy(issues.priority);

  const byPriority = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const row of priorityRows) {
    const c = row.count;
    if (row.priority === 'LOW') byPriority.low = c;
    else if (row.priority === 'MEDIUM') byPriority.medium = c;
    else if (row.priority === 'HIGH') byPriority.high = c;
    else if (row.priority === 'CRITICAL') byPriority.critical = c;
  }

  // 3. Mine counts
  const [mineStats] = await db
    .select({
      assigned: sql<number>`count(*) filter (where ${issues.assigneeId} = ${user.id})::int`,
      assignedOpen: sql<number>`count(*) filter (where ${issues.assigneeId} = ${user.id} and ${issues.status} = 'OPEN')::int`,
      reported: sql<number>`count(*) filter (where ${issues.reporterId} = ${user.id})::int`,
    })
    .from(issues)
    .where(notDeleted(issues));

  const mine = {
    assigned: mineStats?.assigned ?? 0,
    assignedOpen: mineStats?.assignedOpen ?? 0,
    reported: mineStats?.reported ?? 0,
  };

  // 4. 5 Most recent issues
  const recent = await db
    .select({
      id: issues.id,
      issueNumber: issues.issueNumber,
      title: issues.title,
      status: issues.status,
      priority: issues.priority,
      createdAt: issues.createdAt,
      reporter: {
        id: reporters.id,
        name: reporters.name,
      },
      assignee: {
        id: assignees.id,
        name: assignees.name,
      },
    })
    .from(issues)
    .innerJoin(reporters, eq(issues.reporterId, reporters.id))
    .leftJoin(assignees, eq(issues.assigneeId, assignees.id))
    .where(notDeleted(issues))
    .orderBy(desc(issues.createdAt))
    .limit(5);

  // 5. Admin-only metrics
  let adminData:
    | {
        unassigned: number;
        users: { total: number; active: number };
      }
    | undefined = undefined;

  if (user.role === 'ADMIN') {
    const unassignedResult = await db
      .select({ unassignedCount: sql<number>`count(*)::int` })
      .from(issues)
      .where(and(notDeleted(issues), isNull(issues.assigneeId)));

    const usersResult = await db
      .select({
        totalUsers: sql<number>`count(*)::int`,
        activeUsers: sql<number>`count(*) filter (where ${users.isActive} = true)::int`,
      })
      .from(users);

    adminData = {
      unassigned: unassignedResult[0]?.unassignedCount ?? 0,
      users: {
        total: usersResult[0]?.totalUsers ?? 0,
        active: usersResult[0]?.activeUsers ?? 0,
      },
    };
  }

  return {
    totals,
    byPriority,
    mine,
    recent,
    ...(adminData ? { admin: adminData } : {}),
  };
};
