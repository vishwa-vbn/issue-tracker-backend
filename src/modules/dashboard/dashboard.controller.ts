import type { Request, Response } from 'express';
import * as dashboardService from './dashboard.service.js';
import { ok } from '../../lib/respond.js';

export const getSummary = async (req: Request, res: Response) => {
  const summary = await dashboardService.getDashboardSummary(req.user!);
  ok(res, summary);
};

