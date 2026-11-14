import { Router } from 'express';
import * as usersController from './users.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  userIdParamsSchema,
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} from './users.schemas.js';

const router = Router();

router.get('/assignable', authenticate, usersController.getAssignable);

router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate({ body: createUserSchema }),
  usersController.createUser,
);

router.get(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate({ query: listUsersQuerySchema }),
  usersController.listUsers,
);

router.get(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  validate({ params: userIdParamsSchema }),
  usersController.getUserById,
);

router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  validate({ params: userIdParamsSchema, body: updateUserSchema }),
  usersController.updateUser,
);

router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  validate({ params: userIdParamsSchema }),
  usersController.deleteUser,
);

export default router;
