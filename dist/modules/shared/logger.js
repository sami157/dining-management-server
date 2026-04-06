"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = exports.logWarn = exports.logInfo = exports.getRequestLogContext = void 0;
const writeLog = (level, context) => {
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
const getRequestLogContext = (req) => ({
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl
});
exports.getRequestLogContext = getRequestLogContext;
const logInfo = (event, context = {}) => {
    writeLog('info', { event, ...context });
};
exports.logInfo = logInfo;
const logWarn = (event, context = {}) => {
    writeLog('warn', { event, ...context });
};
exports.logWarn = logWarn;
const logError = (event, context = {}) => {
    writeLog('error', { event, ...context });
};
exports.logError = logError;
