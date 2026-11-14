import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

// Pre-computed bcrypt hash (cost 12) used when user email is not found to equalise compare timing
export const DUMMY_HASH = '$2a$12$e8n1X9V3W0L4yPZ1u1/mwev4bN.6R1wL6vU1mXwU6vU1mXwU6vU1m';

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
