"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const admin = require("../config/firebaseAdmin");
const { getCollections } = require("../config/connectMongodb");
const { createHttpError } = require("./errorHandler");
const verifyFirebaseToken = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.split(" ")[1];
            if (!idToken) {
                return next(createHttpError(401, "Missing authorization token"));
            }
            const decoded = await admin.auth().verifyIdToken(idToken);
            const { users } = await getCollections();
            const user = await users.findOne({ email: decoded.email });
            if (!Array.isArray(allowedRoles)) {
                return next(createHttpError(500, "Invalid auth middleware configuration"));
            }
            if (allowedRoles.length > 0 && !user) {
                return next(createHttpError(403, "Unauthorized"));
            }
            if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
                return next(createHttpError(403, "Forbidden"));
            }
            req.firebaseUser = decoded;
            req.user = user || null;
            return next();
        }
        catch (err) {
            return next(createHttpError(403, "Unauthorized"));
        }
    };
};
module.exports = verifyFirebaseToken;
