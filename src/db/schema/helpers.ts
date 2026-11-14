import { isNull, type AnyColumn } from 'drizzle-orm';

export const notDeleted = (table: { deletedAt: AnyColumn }) => isNull(table.deletedAt);
