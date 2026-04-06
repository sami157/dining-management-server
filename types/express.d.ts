import type { AuthClaims, AppUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: AuthClaims;
      user?: AppUser | null;
    }
  }
}

export {};
