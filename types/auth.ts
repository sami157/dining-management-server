import type { ObjectId } from 'mongodb';

export type AuthClaims = {
  uid: string;
  email: string;
  emailVerified: boolean;
};

export type AppUser = {
  _id?: ObjectId;
  firebaseUid?: string;
  email?: string;
  role?: string;
  name?: string;
  fixedDeposit?: number;
  mosqueFee?: number;
};
