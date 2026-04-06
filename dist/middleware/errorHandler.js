"use strict";
const zod_1 = require("zod");
const logger_1 = require("../modules/shared/logger");
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
    const isValidationError = error instanceof zod_1.ZodError;
    const status = isValidationError ? 400 : (error.status || 500);
    const message = isValidationError ? 'Validation failed' : (error.message || 'Internal Server Error');
    (0, logger_1.logError)('request_error', {
        ...(0, logger_1.getRequestLogContext)(req),
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
