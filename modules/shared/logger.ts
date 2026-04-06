import type { Request } from 'express';

type LogLevel = 'info' | 'warn' | 'error';

type LogContext = {
  event: string;
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  code?: string;
  details?: unknown;
  errorName?: string;
  errorMessage?: string;
  stack?: string;
  [key: string]: unknown;
};

const writeLog = (level: LogLevel, context: LogContext) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    ...context
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
};

const getRequestLogContext = (req: Request) => ({
  requestId: req.requestId,
  method: req.method,
  path: req.originalUrl
});

const logInfo = (event: string, context: Omit<LogContext, 'event'> = {}) => {
  writeLog('info', { event, ...context });
};

const logWarn = (event: string, context: Omit<LogContext, 'event'> = {}) => {
  writeLog('warn', { event, ...context });
};

const logError = (event: string, context: Omit<LogContext, 'event'> = {}) => {
  writeLog('error', { event, ...context });
};

export {
  getRequestLogContext,
  logInfo,
  logWarn,
  logError
};
