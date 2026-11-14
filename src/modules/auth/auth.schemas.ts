import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must not exceed 72 characters')
  .regex(/[A-Za-z]/, 'Password must include at least one letter')
  .regex(/\d/, 'Password must include at least one number');

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(80, 'Name must not exceed 80 characters'),
    email: z
      .string()
      .trim()
      .email('Invalid email address')
      .max(254, 'Email must not exceed 254 characters'),
    password: passwordSchema,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
