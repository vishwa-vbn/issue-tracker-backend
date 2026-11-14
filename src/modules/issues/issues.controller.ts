import type { Request, Response } from 'express';
import * as issuesService from './issues.service.js';
import * as activityService from './activity.service.js';
import { ok, created, paginated, noContent } from '../../lib/respond.js';
import type { ListIssuesQuery } from './issues.schemas.js';

export const listIssues = async (req: Request, res: Response) => {
  const query = req.query as unknown as ListIssuesQuery;
  const { rows, meta } = await issuesService.listIssues(req.user!, query);
  paginated(res, rows, meta);
};

export const getIssueById = async (req: Request, res: Response) => {
  const issue = await issuesService.getIssueById(req.params.id as string);
  ok(res, issue);
};

export const createIssue = async (req: Request, res: Response) => {
  const issue = await issuesService.createIssue(req.user!, req.body);
  created(res, issue);
};

export const updateIssue = async (req: Request, res: Response) => {
  const issue = await issuesService.updateIssue(req.user!, req.params.id as string, req.body);
  ok(res, issue);
};

export const changeStatus = async (req: Request, res: Response) => {
  const issue = await issuesService.changeStatus(
    req.user!,
    req.params.id as string,
    req.body.status,
  );
  ok(res, issue);
};

export const assignIssue = async (req: Request, res: Response) => {
  const issue = await issuesService.assignIssue(
    req.user!,
    req.params.id as string,
    req.body.assigneeId,
  );
  ok(res, issue);
};

export const deleteIssue = async (req: Request, res: Response) => {
  await issuesService.deleteIssue(req.user!, req.params.id as string);
  noContent(res);
};

export const getActivity = async (req: Request, res: Response) => {
  const activities = await activityService.getActivityTimeline(req.params.id as string);
  ok(res, activities);
};

