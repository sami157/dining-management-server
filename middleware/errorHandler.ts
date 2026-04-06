import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { getRequestLogContext, logError } from '../modules/shared/logger';

type HttpErrorOptions = {
  code?: string;
  details?: unknown;
};

type HttpError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
};

const createHttpError = (status: number, message: string, options: HttpErrorOptions = {}): HttpError => {
  const error = new Error(message) as HttpError;
  error.status = status;

  if (options.code) {
    error.code = options.code;
  }

  if (options.details !== undefined) {
    error.details = options.details;
  }

  return error;
};

const asyncHandler = <T extends RequestHandler>(handler: T): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(createHttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

const globalErrorHandler = (error: HttpError, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(error);
  }

  const isValidationError = error instanceof ZodError;
  const status = isValidationError ? 400 : (error.status || 500);
  const message = isValidationError ? 'Validation failed' : (error.message || 'Internal Server Error');

  logError('request_error', {
    ...getRequestLogContext(req),
    status,
    code: error.code,
    details: isValidationError
      ? error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
      : error.details,
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack
  });

  const payload: {
    error: string;
    code?: string;
    details?: unknown;
  } = { error: message };

  if (error.code) {
    payload.code = error.code;
  }

  if (isValidationError) {
    payload.details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
  } else if (error.details !== undefined) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
};

export = {
  createHttpError,
  asyncHandler,
  notFoundHandler,
  globalErrorHandler
};
