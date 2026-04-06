"use strict";
const crypto_1 = require("crypto");
const attachRequestContext = (req, res, next) => {
    const requestId = req.headers['x-request-id'];
    req.requestId = typeof requestId === 'string' && requestId.trim() ? requestId : (0, crypto_1.randomUUID)();
    res.setHeader('x-request-id', req.requestId);
    next();
};
module.exports = {
    attachRequestContext
};
