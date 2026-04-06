import { ObjectId } from 'mongodb';
const { getCollections } = require('../../config/connectMongodb');
const admin = require('../../config/firebaseAdmin');
const { createHttpError } = require('../finance/finance.utils');
const { assertRolePolicy } = require('../shared/service-rules');
import type { AppUser, AuthClaims } from '../../types/auth';

const VALID_ROLES = ['admin', 'manager', 'member', 'moderator', 'staff', 'super_admin'];

type UserRole = typeof VALID_ROLES[number];

type UserRecord = AppUser & {
  _id?: ObjectId;
  firebaseUid?: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  phoneNumber?: string;
  photoURL?: string;
  providers?: string[];
  name?: string;
  building?: string;
  room?: string;
  mobile?: string;
  bank?: string;
  designation?: string;
  department?: string;
  role?: UserRole;
  fixedDeposit?: number;
  mosqueFee?: number;
  createdAt?: Date;
  updatedAt?: Date;
  lastSyncedAt?: Date;
};

type UserPayload = {
  name?: string;
  building?: string;
  room?: string;
  email?: string;
  mobile?: string;
  designation?: string;
  bank?: string;
  department?: string;
};

const registerOrSyncUser = async (payload: UserPayload, firebaseUserToken?: AuthClaims) => {
  const { name, building, room, email, mobile, designation, bank, department } = payload;
  const firebaseUid = firebaseUserToken?.uid;
  const tokenEmail = firebaseUserToken?.email;

  if (!firebaseUid || !tokenEmail) {
    throw createHttpError(401, 'Authenticated Firebase user is required');
  }

  if (email && email !== tokenEmail) {
    throw createHttpError(400, 'Email must match the authenticated Firebase user');
  }

  if (!name || !mobile) {
    throw createHttpError(400, 'name and mobile are required');
  }

  const firebaseUser = await admin.auth().getUser(firebaseUid);
  const { users } = await getCollections();
  const existingUser = await users.findOne({
    $or: [
      { email: tokenEmail },
      { firebaseUid }
    ]
  }) as UserRecord | null;

  const now = new Date();
  const syncData = {
    firebaseUid,
    email: firebaseUser.email || tokenEmail,
    emailVerified: Boolean(firebaseUser.emailVerified),
    displayName: firebaseUser.displayName || '',
    phoneNumber: firebaseUser.phoneNumber || '',
    photoURL: firebaseUser.photoURL || '',
    providers: (firebaseUser.providerData || []).map(provider => provider.providerId),
    lastSyncedAt: now,
    updatedAt: now
  };

  if (existingUser) {
    const updateData = {
      ...syncData,
      name,
      building,
      room,
      mobile,
      bank,
      designation: designation || '',
      department: department || ''
    };

    await users.updateOne({ _id: existingUser._id }, { $set: updateData });
    const user = await users.findOne({ _id: existingUser._id }) as UserRecord | null;

    return {
      status: 200,
      message: 'User synced successfully',
      userId: existingUser._id,
      user
    };
  }

  const newUser: UserRecord = {
    firebaseUid,
    email: firebaseUser.email || tokenEmail,
    emailVerified: Boolean(firebaseUser.emailVerified),
    displayName: firebaseUser.displayName || '',
    phoneNumber: firebaseUser.phoneNumber || '',
    photoURL: firebaseUser.photoURL || '',
    providers: (firebaseUser.providerData || []).map(provider => provider.providerId),
    name,
    building,
    room,
    mobile,
    bank,
    designation: designation || '',
    department: department || '',
    role: 'member',
    fixedDeposit: 0,
    mosqueFee: 0,
    createdAt: now,
    updatedAt: now,
    lastSyncedAt: now
  };

  const result = await users.insertOne(newUser);

  return {
    status: 201,
    message: 'User registered and synced successfully',
    userId: result.insertedId,
    user: { ...newUser, _id: result.insertedId }
  };
};

const getUserProfileById = async (userId?: ObjectId) => {
  if (!userId) {
    throw createHttpError(401, 'Authenticated application user is required');
  }

  const { users } = await getCollections();
  const user = await users.findOne({ _id: userId }) as UserRecord | null;

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return user;
};

const updateUserProfileById = async (userId: ObjectId | undefined, payload: UserPayload) => {
  if (!userId) {
    throw createHttpError(401, 'Authenticated application user is required');
  }

  const { name, building, room, mobile, designation, department } = payload;
  const updateData: Partial<UserRecord> = { updatedAt: new Date() };

  if (name) updateData.name = name;
  if (building) updateData.building = building;
  if (room) updateData.room = room;
  if (mobile) updateData.mobile = mobile;
  if (designation !== undefined) updateData.designation = designation;
  if (department !== undefined) updateData.department = department;

  const { users } = await getCollections();
  const user = await users.findOneAndUpdate(
    { _id: userId },
    { $set: updateData },
    { returnDocument: 'after' }
  ) as UserRecord | null;

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return user;
};

const updateUserRoleById = async (userId: string, role: UserRole, currentUserRole: string) => {
  assertRolePolicy(currentUserRole, 'userRoleManagement', 'Only admins, managers, and super admins can update user roles');

  if (!ObjectId.isValid(userId)) {
    throw createHttpError(400, 'Invalid user ID');
  }

  if (!role || !VALID_ROLES.includes(role)) {
    throw createHttpError(400, `role must be one of: ${VALID_ROLES.join(', ')}`);
  }

  const { users } = await getCollections();
  const user = await users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { role, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return user;
};

const updateFixedDepositByUserId = async (userId: string, fixedDeposit: number, currentUserRole: string) => {
  if (!ObjectId.isValid(userId)) {
    throw createHttpError(400, 'Invalid user ID');
  }

  assertRolePolicy(currentUserRole, 'memberFinanceManagement');

  const { users } = await getCollections();
  const user = await users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { fixedDeposit, updatedAt: new Date() } },
    { returnDocument: 'after' }
  ) as UserRecord | null;

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return user;
};

const updateMosqueFeeByUserId = async (userId: string, mosqueFee: number, currentUserRole: string) => {
  if (!ObjectId.isValid(userId)) {
    throw createHttpError(400, 'Invalid user ID');
  }

  assertRolePolicy(currentUserRole, 'memberFinanceManagement');

  const { users } = await getCollections();
  const user = await users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { mosqueFee, updatedAt: new Date() } },
    { returnDocument: 'after' }
  ) as UserRecord | null;

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return user;
};

const listUsers = async ({ role, department }: { role?: UserRole; department?: string }) => {
  const query: { role?: UserRole; department?: string } = {};

  if (role && VALID_ROLES.includes(role)) query.role = role;
  if (department) query.department = department;

  const { users } = await getCollections();
  const usersList = await users.find(query).sort({ room: 1 }).toArray() as UserRecord[];
  const totalFixedDeposit = usersList.reduce((sum, user) => sum + (user.fixedDeposit || 0), 0);

  return { count: usersList.length, users: usersList, totalFixedDeposit };
};

const getRoleByEmail = async (email: string) => {
  if (!email) {
    throw createHttpError(400, 'Email is required');
  }

  const { users } = await getCollections();
  const user = await users.findOne({ email }) as UserRecord | null;

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return { role: user.role };
};

const checkUserExistsByEmail = async (email: string) => {
  if (!email) {
    throw createHttpError(400, 'Email is required');
  }

  const { users } = await getCollections();
  const user = await users.findOne({ email }) as UserRecord | null;

  return { doesExist: Boolean(user) };
};

export = {
  registerOrSyncUser,
  getUserProfileById,
  updateUserProfileById,
  updateUserRoleById,
  updateFixedDepositByUserId,
  updateMosqueFeeByUserId,
  listUsers,
  getRoleByEmail,
  checkUserExistsByEmail
};

