import type { Request, Response } from 'express';
import * as commentsService from './comments.service.js';
import { ok, created, paginated, noContent } from '../../lib/respond.js';
import type { ListCommentsQuery } from './comments.schemas.js';

export const listComments = async (req: Request, res: Response) => {
  const query = req.query as unknown as ListCommentsQuery;
  const { rows, meta } = await commentsService.listComments(
    req.params.issueId as string,
    query.page,
    query.limit,
  );
  paginated(res, rows, meta);
};

export const createComment = async (req: Request, res: Response) => {
  const comment = await commentsService.createComment(
    req.user!,
    req.params.issueId as string,
    req.body.body,
  );
  created(res, comment);
};

export const updateComment = async (req: Request, res: Response) => {
  const comment = await commentsService.updateComment(
    req.user!,
    req.params.id as string,
    req.body.body,
  );
  ok(res, comment);
};

export const deleteComment = async (req: Request, res: Response) => {
  await commentsService.deleteComment(req.user!, req.params.id as string);
  noContent(res);
};

