// @ts-nocheck
const { ObjectId } = require('mongodb');
const { getCollections } = require('../../config/connectMongodb');
const admin = require('../../config/firebaseAdmin');
const { createHttpError } = require('../finance/finance.utils');
const { assertAllowedRole } = require('../shared/service-rules');

const VALID_ROLES = ['admin', 'manager', 'member', 'moderator', 'staff', 'super_admin'];

const registerOrSyncUser = async (payload, firebaseUserToken) => {
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
  });

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
    const user = await users.findOne({ _id: existingUser._id });

    return {
      status: 200,
      message: 'User synced successfully',
      userId: existingUser._id,
      user
    };
  }

  const newUser = {
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

const getUserProfileByEmail = async (email) => {
  const { users } = await getCollections();
  const user = await users.findOne({ email });

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return user;
};

const updateUserProfileByEmail = async (email, payload) => {
  const { name, building, room, mobile, designation, department } = payload;
  const updateData = { updatedAt: new Date() };

  if (name) updateData.name = name;
  if (building) updateData.building = building;
  if (room) updateData.room = room;
  if (mobile) updateData.mobile = mobile;
  if (designation !== undefined) updateData.designation = designation;
  if (department !== undefined) updateData.department = department;

  const { users } = await getCollections();
  const user = await users.findOneAndUpdate(
    { email },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return user;
};

const updateUserRoleById = async (userId, role, currentUserRole) => {
  assertAllowedRole(currentUserRole, ['admin', 'manager'], 'Only admins and managers can update user roles');

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

const updateFixedDepositByUserId = async (userId, fixedDeposit, currentUserRole) => {
  if (!ObjectId.isValid(userId)) {
    throw createHttpError(400, 'Invalid user ID');
  }

  assertAllowedRole(currentUserRole, ['admin', 'super_admin']);

  const { users } = await getCollections();
  const user = await users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { fixedDeposit, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return user;
};

const updateMosqueFeeByUserId = async (userId, mosqueFee, currentUserRole) => {
  if (!ObjectId.isValid(userId)) {
    throw createHttpError(400, 'Invalid user ID');
  }

  assertAllowedRole(currentUserRole, ['admin', 'super_admin']);

  const { users } = await getCollections();
  const user = await users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: { mosqueFee, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return user;
};

const listUsers = async ({ role, department }) => {
  const query = {};

  if (role && VALID_ROLES.includes(role)) query.role = role;
  if (department) query.department = department;

  const { users } = await getCollections();
  const usersList = await users.find(query).sort({ room: 1 }).toArray();
  const totalFixedDeposit = usersList.reduce((sum, user) => sum + (user.fixedDeposit || 0), 0);

  return { count: usersList.length, users: usersList, totalFixedDeposit };
};

const getRoleByEmail = async (email) => {
  if (!email) {
    throw createHttpError(400, 'Email is required');
  }

  const { users } = await getCollections();
  const user = await users.findOne({ email });

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return { role: user.role };
};

const checkUserExistsByEmail = async (email) => {
  if (!email) {
    throw createHttpError(400, 'Email is required');
  }

  const { users } = await getCollections();
  const user = await users.findOne({ email });

  return { doesExist: Boolean(user) };
};

module.exports = {
  registerOrSyncUser,
  getUserProfileByEmail,
  updateUserProfileByEmail,
  updateUserRoleById,
  updateFixedDepositByUserId,
  updateMosqueFeeByUserId,
  listUsers,
  getRoleByEmail,
  checkUserExistsByEmail
};

