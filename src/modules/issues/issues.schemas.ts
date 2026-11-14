import { z } from 'zod';
import { ISSUE_STATUS, ISSUE_PRIORITY } from '../../constants/issue.js';

export const issueIdParamsSchema = z
  .object({
    id: z.string().uuid('Invalid issue ID format'),
  })
  .strict();

export const createIssueSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(150, 'Title must not exceed 150 characters'),
    description: z.string().max(5000, 'Description must not exceed 5000 characters').default(''),
    priority: z
      .enum(Object.values(ISSUE_PRIORITY) as [string, ...string[]])
      .optional()
      .default('MEDIUM'),
    assigneeId: z.string().uuid('Invalid assignee ID format').nullable().optional(),
  })
  .strict();

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const updateIssueSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty')
      .max(150, 'Title must not exceed 150 characters')
      .optional(),
    description: z.string().max(5000, 'Description must not exceed 5000 characters').optional(),
    priority: z.enum(Object.values(ISSUE_PRIORITY) as [string, ...string[]]).optional(),
  })
  .strict();

export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;

export const changeStatusSchema = z
  .object({
    status: z.enum(Object.values(ISSUE_STATUS) as [string, ...string[]]),
  })
  .strict();

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export const assignIssueSchema = z
  .object({
    assigneeId: z.string().uuid('Invalid assignee ID format').nullable(),
  })
  .strict();

export type AssignIssueInput = z.infer<typeof assignIssueSchema>;

export const listIssuesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    q: z.string().trim().optional(),
    status: z.enum(Object.values(ISSUE_STATUS) as [string, ...string[]]).optional(),
    priority: z.enum(Object.values(ISSUE_PRIORITY) as [string, ...string[]]).optional(),
    assigneeId: z
      .string()
      .trim()
      .refine(
        (val) =>
          val === 'null' ||
          val === 'undefined' ||
          val === '' ||
          z.string().uuid().safeParse(val).success,
        { message: 'Invalid assignee ID format' },
      )
      .optional(),
    reporterId: z
      .string()
      .trim()
      .refine(
        (val) =>
          val === 'null' ||
          val === 'undefined' ||
          val === '' ||
          z.string().uuid().safeParse(val).success,
        { message: 'Invalid reporter ID format' },
      )
      .optional(),
    unassigned: z
      .union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')])
      .optional(),
    sort: z
      .enum(['createdAt', 'updatedAt', 'priority', 'status', 'title', 'issueNumber'])
      .default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
