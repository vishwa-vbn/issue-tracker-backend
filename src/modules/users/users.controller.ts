import type { Request, Response } from 'express';
import * as usersService from './users.service.js';
import { ok, paginated } from '../../lib/respond.js';
import type { ListUsersQuery } from './users.schemas.js';

export const getAssignable = async (_req: Request, res: Response) => {
  const assignableUsers = await usersService.getAssignableUsers();
  ok(res, assignableUsers);
};

export const listUsers = async (req: Request, res: Response) => {
  const query = req.query as unknown as ListUsersQuery;
  const { rows, meta } = await usersService.listUsers(query);
  paginated(res, rows, meta);
};

export const updateUser = async (req: Request, res: Response) => {
  const updated = await usersService.updateUser(req.user!, req.params.id as string, req.body);
  ok(res, updated);
};
