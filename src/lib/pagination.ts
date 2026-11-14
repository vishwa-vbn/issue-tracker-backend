import type { PageMeta } from './respond.js';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export const calculatePagination = (
  page = 1,
  limit = 10,
  total = 0,
): {
  offset: number;
  limit: number;
  meta: PageMeta;
} => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;
  const totalPages = Math.ceil(total / safeLimit);

  return {
    offset,
    limit: safeLimit,
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
    },
  };
};
