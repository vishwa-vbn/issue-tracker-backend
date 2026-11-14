/**
 * Escapes characters that have special meaning in PostgreSQL LIKE/ILIKE patterns.
 * Special characters: %, _, \
 */
export const escapeLike = (str: string): string => {
  return str.replace(/[%_\\]/g, '\\$&');
};

