import type { NextFunction, Request, Response } from 'express';
import admin = require('../config/firebaseAdmin');
const { getCollections } = require('../config/connectMongodb');
const { createHttpError } = require('./errorHandler');
import type { UserRole } from '../modules/shared/validation';

type VerifyFirebaseTokenOptions = {
  allowMissingUser?: boolean;
};

const getBearerToken = (authHeader?: string) => {
  if (!authHeader) {
    return { error: createHttpError(401, 'Missing authorization token', { code: 'AUTH_MISSING_TOKEN' }) };
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return { error: createHttpError(401, 'Invalid authorization header', { code: 'AUTH_INVALID_AUTH_HEADER' }) };
  }

  return { token };
};

const verifyFirebaseToken = (
  allowedRoles: UserRole[] = [],
  options: VerifyFirebaseTokenOptions = {}
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!Array.isArray(allowedRoles)) {
        return next(createHttpError(500, 'Invalid auth middleware configuration', { code: 'AUTH_CONFIG_ERROR' }));
      }

      const { token, error: authHeaderError } = getBearerToken(req.headers.authorization);
      if (authHeaderError) {
        return next(authHeaderError);
      }

      let decoded;
      try {
        decoded = await (admin as any).auth().verifyIdToken(token);
      } catch {
        return next(createHttpError(401, 'Invalid authorization token', { code: 'AUTH_INVALID_TOKEN' }));
      }

      const { users } = await getCollections();
      const user = await users.findOne({ email: decoded.email });

      const requiresAppUser = !options.allowMissingUser;

      if (requiresAppUser && !user) {
        return next(createHttpError(403, 'Authenticated user is not registered in the application', { code: 'AUTH_APP_USER_NOT_FOUND' }));
      }

      if (allowedRoles.length > 0 && !user) {
        return next(createHttpError(403, 'Authenticated user is not registered in the application', { code: 'AUTH_APP_USER_NOT_FOUND' }));
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role as UserRole)) {
        return next(createHttpError(403, 'Insufficient role permissions', {
          code: 'AUTH_ROLE_FORBIDDEN',
          details: {
            allowedRoles,
            userRole: user.role || null
          }
        }));
      }

      req.firebaseUser = decoded;
      req.user = user || null;
      return next();
    } catch {
      return next(createHttpError(500, 'Authentication middleware failed', { code: 'AUTH_MIDDLEWARE_ERROR' }));
    }
  };
};

export = verifyFirebaseToken;
