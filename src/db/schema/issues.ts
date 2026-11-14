import { pgTable, uuid, integer, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { issueStatusEnum, issuePriorityEnum } from './enums.js';
import { users } from './users.js';

export const issues = pgTable(
  'issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueNumber: integer('issue_number').generatedAlwaysAsIdentity().notNull().unique(),
    title: varchar('title', { length: 150 }).notNull(),
    description: text('description').notNull().default(''),
    status: issueStatusEnum('status').notNull().default('OPEN'),
    priority: issuePriorityEnum('priority').notNull().default('MEDIUM'),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('issues_status_idx')
      .on(t.status)
      .where(sql`${t.deletedAt} IS NULL`),
    index('issues_assignee_idx')
      .on(t.assigneeId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('issues_reporter_idx')
      .on(t.reporterId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('issues_created_at_idx')
      .on(t.createdAt.desc())
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

export type IssueRow = typeof issues.$inferSelect;
export type NewIssueRow = typeof issues.$inferInsert;
