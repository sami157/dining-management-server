"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const { ZodError } = require('zod');
const createHttpError = (status, message, options = {}) => {
    const error = new Error(message);
    error.status = status;
    if (options.code) {
        error.code = options.code;
    }
    if (options.details !== undefined) {
        error.details = options.details;
    }
    return error;
};
const asyncHandler = (handler) => {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
};
const notFoundHandler = (req, res, next) => {
    next(createHttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};
const globalErrorHandler = (error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }
    const isValidationError = error instanceof ZodError;
    const status = isValidationError ? 400 : (error.status || 500);
    const message = isValidationError ? 'Validation failed' : (error.message || 'Internal Server Error');
    console.error(`[${req.method} ${req.originalUrl}]`, error);
    const payload = { error: message };
    if (error.code) {
        payload.code = error.code;
    }
    if (isValidationError) {
        payload.details = error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
        }));
    }
    else if (error.details !== undefined) {
        payload.details = error.details;
    }
    return res.status(status).json(payload);
};
module.exports = {
    createHttpError,
    asyncHandler,
    notFoundHandler,
    globalErrorHandler
};
