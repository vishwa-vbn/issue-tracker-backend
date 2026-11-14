import { eq, desc, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { issueActivity, users, issues, notDeleted } from '../../db/schema/index.js';
import { AppError } from '../../lib/app-error.js';
import type { ActivityType } from '../../constants/issue.js';

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RecordActivityParams {
  issueId: string;
  actorId: string;
  type: ActivityType;
  from?: string | null;
  to?: string | null;
}

export const recordActivity = async (client: DbOrTx, params: RecordActivityParams) => {
  await client.insert(issueActivity).values({
    issueId: params.issueId,
    actorId: params.actorId,
    type: params.type,
    fromValue: params.from ?? null,
    toValue: params.to ?? null,
  });
};

export const getActivityTimeline = async (issueId: string) => {
  // First ensure issue exists and is not soft deleted
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  if (!issue) {
    throw new AppError('ISSUE_NOT_FOUND');
  }

  // Soft delete check
  const [activeIssue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.id, issueId), notDeleted(issues)))
    .limit(1);

  if (!activeIssue) {
    throw new AppError('ISSUE_NOT_FOUND');
  }

  const activities = await db
    .select({
      id: issueActivity.id,
      issueId: issueActivity.issueId,
      type: issueActivity.type,
      fromValue: issueActivity.fromValue,
      toValue: issueActivity.toValue,
      createdAt: issueActivity.createdAt,
      actor: {
        id: users.id,
        name: users.name,
      },
    })
    .from(issueActivity)
    .innerJoin(users, eq(issueActivity.actorId, users.id))
    .where(eq(issueActivity.issueId, issueId))
    .orderBy(desc(issueActivity.createdAt));

  return activities;
};
