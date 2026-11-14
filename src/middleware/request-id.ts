import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.trim() !== '' ? incoming : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
};

