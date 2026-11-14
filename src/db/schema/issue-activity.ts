import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { activityTypeEnum } from './enums.js';
import { users } from './users.js';
import { issues } from './issues.js';

export const issueActivity = pgTable(
  'issue_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    type: activityTypeEnum('type').notNull(),
    fromValue: varchar('from_value', { length: 100 }),
    toValue: varchar('to_value', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('activity_issue_idx').on(t.issueId, t.createdAt)],
);

export type IssueActivityRow = typeof issueActivity.$inferSelect;
export type NewIssueActivityRow = typeof issueActivity.$inferInsert;

