import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const attachRequestContext = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'];
  req.requestId = typeof requestId === 'string' && requestId.trim() ? requestId : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};

export = {
  attachRequestContext
};
