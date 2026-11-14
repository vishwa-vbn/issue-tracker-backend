import { Router } from 'express';
import * as issuesController from './issues.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import {
  issueIdParamsSchema,
  createIssueSchema,
  updateIssueSchema,
  changeStatusSchema,
  assignIssueSchema,
  listIssuesQuerySchema,
} from './issues.schemas.js';

const router = Router();

router.get(
  '/',
  authenticate,
  validate({ query: listIssuesQuerySchema }),
  issuesController.listIssues,
);

router.post('/', authenticate, validate({ body: createIssueSchema }), issuesController.createIssue);

router.get(
  '/:id',
  authenticate,
  validate({ params: issueIdParamsSchema }),
  issuesController.getIssueById,
);

router.patch(
  '/:id',
  authenticate,
  validate({ params: issueIdParamsSchema, body: updateIssueSchema }),
  issuesController.updateIssue,
);

router.patch(
  '/:id/status',
  authenticate,
  validate({ params: issueIdParamsSchema, body: changeStatusSchema }),
  issuesController.changeStatus,
);

router.patch(
  '/:id/assignee',
  authenticate,
  validate({ params: issueIdParamsSchema, body: assignIssueSchema }),
  issuesController.assignIssue,
);

router.delete(
  '/:id',
  authenticate,
  validate({ params: issueIdParamsSchema }),
  issuesController.deleteIssue,
);

router.get(
  '/:id/activity',
  authenticate,
  validate({ params: issueIdParamsSchema }),
  issuesController.getActivity,
);

export default router;
