import type { NextFunction, Request, Response } from 'express';
import admin = require('../config/firebaseAdmin');
const { getCollections } = require('../config/connectMongodb');
const { createHttpError } = require('./errorHandler');
import type { UserRole } from '../modules/shared/validation';

const verifyFirebaseToken = (allowedRoles: UserRole[] = []) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.split(' ')[1];

      if (!idToken) {
        return next(createHttpError(401, 'Missing authorization token'));
      }

      const decoded = await (admin as any).auth().verifyIdToken(idToken);
      const { users } = await getCollections();
      const user = await users.findOne({ email: decoded.email });

      if (!Array.isArray(allowedRoles)) {
        return next(createHttpError(500, 'Invalid auth middleware configuration'));
      }

      if (allowedRoles.length > 0 && !user) {
        return next(createHttpError(403, 'Unauthorized'));
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role as UserRole)) {
        return next(createHttpError(403, 'Forbidden'));
      }

      req.firebaseUser = decoded;
      req.user = user || null;
      return next();
    } catch {
      return next(createHttpError(403, 'Unauthorized'));
    }
  };
};

export = verifyFirebaseToken;
