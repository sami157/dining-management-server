// @ts-nocheck
const { ObjectId } = require('mongodb');
const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('./finance.utils');

const normalizeUserId = (value) => {
  if (!value) {
    throw createHttpError(400, 'User ID is required');
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  throw createHttpError(400, 'Invalid user ID');
};

const getUserProjectionById = async (users, userId) => {
  if (!ObjectId.isValid(userId)) {
    throw createHttpError(400, 'Invalid user ID');
  }

  return users.findOne({ _id: new ObjectId(userId) });
};

const listBalances = async () => {
  const { users, memberBalances } = await getCollections();
  const allBalances = await memberBalances.find({}).toArray();

  const userIds = allBalances
    .filter(balance => ObjectId.isValid(balance.userId))
    .map(balance => new ObjectId(balance.userId));

  const usersList = await users.find({ _id: { $in: userIds } }).toArray();
  const usersMap = {};
  for (const user of usersList) {
    usersMap[user._id.toString()] = user;
  }

  const balances = allBalances.map(balance => {
    const user = usersMap[balance.userId];
    return {
      userId: balance.userId,
      userName: user?.name || 'Unknown',
      email: user?.email || '',
      balance: balance.balance,
      lastUpdated: balance.lastUpdated
    };
  });

  balances.sort((a, b) => a.userName.localeCompare(b.userName));
  return { count: balances.length, balances };
};

const getBalanceByUserId = async (userId) => {
  const normalizedUserId = normalizeUserId(userId);
  const { users, memberBalances } = await getCollections();
  const balance = await memberBalances.findOne({ userId: normalizedUserId });

  if (!balance) {
    const user = await getUserProjectionById(users, normalizedUserId);
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    return {
      userId: normalizedUserId,
      userName: user.name,
      email: user.email,
      balance: 0,
      lastUpdated: null
    };
  }

  const user = await getUserProjectionById(users, balance.userId);
  return {
    userId: balance.userId,
    userName: user?.name || 'Unknown',
    email: user?.email || '',
    balance: balance.balance,
    lastUpdated: balance.lastUpdated
  };
};

const getBalanceForCurrentUser = async (currentUserId) => {
  const userId = normalizeUserId(currentUserId);
  const { users, memberBalances } = await getCollections();
  const balance = await memberBalances.findOne({ userId });

  if (!balance) {
    const user = await getUserProjectionById(users, userId);
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    return {
      userId,
      userName: user.name,
      email: user.email,
      balance: 0,
      lastUpdated: null
    };
  }

  const user = await getUserProjectionById(users, balance.userId);
  return {
    userName: user?.name || 'Unknown',
    email: user?.email || 'N/A',
    balance: balance.balance.toFixed(2),
    lastUpdated: balance.lastUpdated
  };
};

module.exports = {
  listBalances,
  getBalanceByUserId,
  getBalanceForCurrentUser
};

