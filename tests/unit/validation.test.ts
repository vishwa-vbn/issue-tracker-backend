import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../../src/modules/auth/auth.schemas.js';
import { createIssueSchema } from '../../src/modules/issues/issues.schemas.js';
import { updateUserSchema, createUserSchema } from '../../src/modules/users/users.schemas.js';

describe('Validation Schemas', () => {
  describe('registerSchema', () => {
    it('accepts valid input', () => {
      const valid = {
        name: 'Asha Rao',
        email: 'asha@example.com',
        password: 'Passw0rdOK',
      };
      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects passwords shorter than 8 characters', () => {
      const input = {
        name: 'Asha Rao',
        email: 'asha@example.com',
        password: 'Pass1',
      };
      const result = registerSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects passwords without numbers', () => {
      const input = {
        name: 'Asha Rao',
        email: 'asha@example.com',
        password: 'PasswordOnly',
      };
      const result = registerSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects unknown fields to prevent mass assignment', () => {
      const input = {
        name: 'Asha Rao',
        email: 'asha@example.com',
        password: 'Passw0rdOK',
        role: 'ADMIN', // Mass assignment attempt!
      };
      const result = registerSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts valid credentials', () => {
      const result = loginSchema.safeParse({
        email: 'admin@example.com',
        password: 'ChangeMe123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email format', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'ChangeMe123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createIssueSchema', () => {
    it('accepts valid issue payload with defaults', () => {
      const result = createIssueSchema.safeParse({
        title: 'New bug found in production',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('MEDIUM');
        expect(result.data.description).toBe('');
      }
    });

    it('rejects empty title', () => {
      const result = createIssueSchema.safeParse({
        title: '   ',
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown fields', () => {
      const result = createIssueSchema.safeParse({
        title: 'Valid title',
        status: 'CLOSED', // status must not be settable on creation
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateUserSchema', () => {
    it('accepts name and email update', () => {
      const result = updateUserSchema.safeParse({
        name: 'New Name',
        email: 'newemail@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('accepts role update', () => {
      const result = updateUserSchema.safeParse({ role: 'ADMIN' });
      expect(result.success).toBe(true);
    });

    it('accepts isActive update', () => {
      const result = updateUserSchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });

    it('rejects empty update object', () => {
      const result = updateUserSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('createUserSchema', () => {
    it('accepts valid user creation input', () => {
      const result = createUserSchema.safeParse({
        name: 'Bob Martin',
        email: 'bob@example.com',
        password: 'Passw0rd123',
        role: 'ADMIN',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = createUserSchema.safeParse({
        name: 'Bob Martin',
        email: 'not-an-email',
        password: 'Passw0rd123',
      });
      expect(result.success).toBe(false);
    });
  });
});

