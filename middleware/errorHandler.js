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

  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';

  console.error(`[${req.method} ${req.originalUrl}]`, error);

  const payload = { error: message };

  if (error.code) {
    payload.code = error.code;
  }

  if (error.details !== undefined) {
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
