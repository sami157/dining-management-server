import type { DecodedIdToken } from 'firebase-admin/auth';

type AppUser = {
  _id: {
    toString(): string;
    equals?(value: unknown): boolean;
  };
  email?: string;
  role?: string;
  name?: string;
  fixedDeposit?: number;
  mosqueFee?: number;
};

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: DecodedIdToken;
      user?: AppUser | null;
    }
  }
}

export {};
