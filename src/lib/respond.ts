import type { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const ok = <T>(res: Response, data: T) => res.status(200).json({ success: true, data });

export const created = <T>(res: Response, data: T) => res.status(201).json({ success: true, data });

export const paginated = <T>(res: Response, data: T[], meta: PageMeta) =>
  res.status(200).json({ success: true, data, meta });

export const noContent = (res: Response) => res.status(204).send();
