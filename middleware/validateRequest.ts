import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

type RequestSchemas = {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
};

const validateRequest = (schemas: RequestSchemas = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as Request['params'];
      }

      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as Request['query'];
      }

      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export = validateRequest;
