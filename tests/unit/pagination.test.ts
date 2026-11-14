import { describe, it, expect } from 'vitest';
import { calculatePagination } from '../../src/lib/pagination.js';

describe('Pagination Lib', () => {
  it('calculates offset, limit and page meta correctly', () => {
    const { offset, limit, meta } = calculatePagination(2, 10, 45);

    expect(offset).toBe(10);
    expect(limit).toBe(10);
    expect(meta).toEqual({
      page: 2,
      limit: 10,
      total: 45,
      totalPages: 5,
    });
  });

  it('clamps minimum page and limits to maximum 50', () => {
    const { offset, limit, meta } = calculatePagination(-5, 100, 20);

    expect(offset).toBe(0);
    expect(limit).toBe(50);
    expect(meta.page).toBe(1);
    expect(meta.totalPages).toBe(1);
  });
});
