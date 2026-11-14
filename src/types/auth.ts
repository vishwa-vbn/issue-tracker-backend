import type { UserRole } from '../constants/roles.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
