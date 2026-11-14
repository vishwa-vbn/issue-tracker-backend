import { z } from 'zod';
import { USER_ROLES } from '../../constants/roles.js';

export const userIdParamsSchema = z
  .object({
    id: z.string().uuid('Invalid user ID format'),
  })
  .strict();

export const updateUserSchema = z
  .object({
    role: z.enum(Object.values(USER_ROLES) as [string, ...string[]]).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.role !== undefined || data.isActive !== undefined, {
    message: 'At least one field (role or isActive) must be provided',
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    q: z.string().trim().optional(),
    role: z.enum(Object.values(USER_ROLES) as [string, ...string[]]).optional(),
    isActive: z
      .union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')])
      .optional(),
  })
  .strict();

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
