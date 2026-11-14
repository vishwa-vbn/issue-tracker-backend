import { z } from 'zod';
import { USER_ROLES } from '../../constants/roles.js';
import { passwordSchema } from '../auth/auth.schemas.js';

export const userIdParamsSchema = z
  .object({
    id: z.string().uuid('Invalid user ID format'),
  })
  .strict();

export const createUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Name must not exceed 80 characters'),
    email: z.string().trim().email('Invalid email address').max(254),
    password: passwordSchema,
    role: z.enum(Object.values(USER_ROLES) as [string, ...string[]]).default('USER'),
    isActive: z.boolean().default(true),
  })
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(80).optional(),
    email: z.string().trim().email('Invalid email address').max(254).optional(),
    role: z.enum(Object.values(USER_ROLES) as [string, ...string[]]).optional(),
    isActive: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.role !== undefined ||
      data.isActive !== undefined ||
      data.password !== undefined,
    { message: 'At least one field (name, email, role, isActive, or password) must be provided' },
  );

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
