import { z } from 'zod';

export const commentIdParamsSchema = z
  .object({
    id: z.string().uuid('Invalid comment ID format'),
  })
  .strict();

export const issueIdParamsSchema = z
  .object({
    issueId: z.string().uuid('Invalid issue ID format'),
  })
  .strict();

export const createCommentSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'Comment body is required')
      .max(2000, 'Comment body must not exceed 2000 characters'),
  })
  .strict();

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'Comment body is required')
      .max(2000, 'Comment body must not exceed 2000 characters'),
  })
  .strict();

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const listCommentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
