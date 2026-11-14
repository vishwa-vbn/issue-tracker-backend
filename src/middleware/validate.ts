import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validate =
  (schemas: ValidationSchemas): RequestHandler =>
  (req, _res, next) => {
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as typeof req.params;
    }
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.query) {
      const parsedQuery = schemas.query.parse(req.query);
      Object.defineProperty(req, 'query', {
        value: parsedQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
