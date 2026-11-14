import { Router } from 'express';
import * as commentsController from './comments.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import {
  commentIdParamsSchema,
  issueIdParamsSchema,
  createCommentSchema,
  updateCommentSchema,
  listCommentsQuerySchema,
} from './comments.schemas.js';

const router = Router();

// /issues/:issueId/comments
router.get(
  '/issues/:issueId/comments',
  authenticate,
  validate({ params: issueIdParamsSchema, query: listCommentsQuerySchema }),
  commentsController.listComments,
);

router.post(
  '/issues/:issueId/comments',
  authenticate,
  validate({ params: issueIdParamsSchema, body: createCommentSchema }),
  commentsController.createComment,
);

// /comments/:id
router.patch(
  '/comments/:id',
  authenticate,
  validate({ params: commentIdParamsSchema, body: updateCommentSchema }),
  commentsController.updateComment,
);

router.delete(
  '/comments/:id',
  authenticate,
  validate({ params: commentIdParamsSchema }),
  commentsController.deleteComment,
);

export default router;
