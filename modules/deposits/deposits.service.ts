import { ObjectId, type ClientSession } from 'mongodb';
const { getCollections, withMongoTransaction } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');
const {
  formatServiceDate,
  getCurrentServiceDate,
  normalizeBusinessDateFields,
  serviceDateToLegacyDate
} = require('../shared/date.utils');
const { assertMonthIsNotFinalized } = require('../shared/service-rules');

type DepositRecord = {
  _id?: ObjectId;
  userId: string;
  amount: number;
  month: string;
  depositDate: Date;
  serviceDate: string;
  notes: string;
  addedBy?: unknown;
  createdAt: Date;
  createdDate: string;
  updatedAt?: Date;
};

type BalanceRecord = {
  userId: string;
  balance: number;
  lastUpdated: Date;
  createdAt?: Date;
};

type UserRecord = {
  _id: ObjectId;
  name?: string;
  email?: string;
};

type DepositPayload = {
  userId?: string;
  amount?: number;
  month?: string;
  depositDate?: string;
  notes?: string;
};

type DepositAggregation = {
  total: number;
  lastUpdated: Date | null;
};

type DepositListQuery = {
  month?: string;
  userId?: string;
};

const addDepositForUser = async ({ userId, amount, month, depositDate, notes }: DepositPayload, managerId: unknown) => {
  if (!userId || !amount || !month) {
    throw createHttpError(400, 'userId, amount, and month are required');
  }

  if (typeof amount !== 'number' || amount <= 0) {
    throw createHttpError(400, 'amount must be a positive number');
  }

  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!monthRegex.test(month)) {
    throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
  }

  return withMongoTransaction(async (session: ClientSession) => {
    const { users, deposits, memberBalances, monthlyFinalization } = await getCollections();
    const user = await users.findOne({ _id: new ObjectId(userId) }, { session }) as UserRecord | null;
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    await assertMonthIsNotFinalized(monthlyFinalization, month, { session });

    const now = new Date();
    const createdDate = getCurrentServiceDate();
    const serviceDate = depositDate ? formatServiceDate(depositDate) : createdDate;
    const deposit: DepositRecord = {
      userId,
      amount,
      month,
      depositDate: serviceDateToLegacyDate(serviceDate),
      serviceDate,
      notes: notes || '',
      addedBy: managerId,
      createdAt: now,
      createdDate
    };

    const result = await deposits.insertOne(deposit, { session });

    await memberBalances.updateOne(
      { userId },
      {
        $inc: { balance: amount },
        $set: { lastUpdated: now },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true, session }
    );

    return {
      depositId: result.insertedId,
      deposit: { ...deposit, _id: result.insertedId }
    };
  });
};

const getMonthlyDepositForCurrentUser = async (userId: string, month: string) => {
  const { users, deposits } = await getCollections();

  const [aggregation] = await deposits.aggregate([
    { $match: { userId, month } },
    { $group: { _id: null, total: { $sum: '$amount' }, lastUpdated: { $max: '$depositDate' } } }
  ]).toArray() as DepositAggregation[];

  const user = await users.findOne({ _id: new ObjectId(userId) }) as UserRecord | null;
  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  return {
    userId,
    userName: user.name,
    email: user.email,
    month,
    deposit: aggregation?.total ?? 0,
    lastUpdated: aggregation?.lastUpdated ?? null,
    lastUpdatedDate: aggregation?.lastUpdated ? formatServiceDate(aggregation.lastUpdated) : null
  };
};

const listDeposits = async ({ month, userId }: { month?: string; userId?: string }) => {
  const query: DepositListQuery = {};
  if (month) query.month = month;
  if (userId) query.userId = userId;

  const { users, deposits } = await getCollections();
  const allDeposits = await deposits.find(query).sort({ serviceDate: -1, createdAt: -1 }).toArray() as DepositRecord[];

  const userIds = [...new Set(allDeposits.map(deposit => deposit.userId))]
    .filter(id => ObjectId.isValid(id))
    .map(id => new ObjectId(id));

  const usersList = await users.find({ _id: { $in: userIds } }).toArray() as UserRecord[];
  const usersMap: Record<string, UserRecord> = {};
  for (const user of usersList) {
    usersMap[user._id.toString()] = user;
  }

  let totalDeposit = 0;
  const depositsWithUsers = allDeposits.map(deposit => {
    totalDeposit += deposit.amount;
    const user = usersMap[deposit.userId];
    return {
      ...normalizeBusinessDateFields(deposit, 'depositDate'),
      createdDate: deposit.createdDate,
      userName: user?.name,
      userEmail: user?.email
    };
  });

  return { count: depositsWithUsers.length, totalDeposit, deposits: depositsWithUsers };
};

const updateDepositById = async (depositId: string, { amount, month, depositDate, notes }: DepositPayload) => {
  if (!ObjectId.isValid(depositId)) {
    throw createHttpError(400, 'Invalid deposit ID');
  }

  return withMongoTransaction(async (session: ClientSession) => {
    const { deposits, memberBalances, monthlyFinalization } = await getCollections();
    const existingDeposit = await deposits.findOne({ _id: new ObjectId(depositId) }, { session }) as DepositRecord | null;
    if (!existingDeposit) {
      throw createHttpError(404, 'Deposit not found');
    }

    const targetMonth = month !== undefined ? month : existingDeposit.month;
    await assertMonthIsNotFinalized(monthlyFinalization, existingDeposit.month, { session });
    if (targetMonth !== existingDeposit.month) {
      await assertMonthIsNotFinalized(monthlyFinalization, targetMonth, { session });
    }

    const oldAmount = existingDeposit.amount;
    const newAmount = amount !== undefined ? amount : oldAmount;
    const amountDifference = newAmount - oldAmount;
    const now = new Date();

    const updateData: Partial<DepositRecord> = { updatedAt: now, createdDate: existingDeposit.createdDate };
    if (amount !== undefined) updateData.amount = amount;
    if (month !== undefined) updateData.month = month;
    if (depositDate !== undefined) {
      const serviceDate = formatServiceDate(depositDate);
      updateData.depositDate = serviceDateToLegacyDate(serviceDate);
      updateData.serviceDate = serviceDate;
    }
    if (notes !== undefined) updateData.notes = notes;

    await deposits.updateOne({ _id: new ObjectId(depositId) }, { $set: updateData }, { session });

    if (amountDifference !== 0) {
      await memberBalances.updateOne(
        { userId: existingDeposit.userId },
        { $inc: { balance: amountDifference }, $set: { lastUpdated: now } },
        { session }
      );
    }
  });
};

const deleteDepositById = async (depositId: string) => {
  if (!ObjectId.isValid(depositId)) {
    throw createHttpError(400, 'Invalid deposit ID');
  }

  return withMongoTransaction(async (session: ClientSession) => {
    const { deposits, memberBalances, monthlyFinalization } = await getCollections();
    const existingDeposit = await deposits.findOne({ _id: new ObjectId(depositId) }, { session }) as DepositRecord | null;
    if (!existingDeposit) {
      throw createHttpError(404, 'Deposit not found');
    }

    await assertMonthIsNotFinalized(monthlyFinalization, existingDeposit.month, { session });

    const now = new Date();
    await deposits.deleteOne({ _id: new ObjectId(depositId) }, { session });
    await memberBalances.updateOne(
      { userId: existingDeposit.userId },
      { $inc: { balance: -existingDeposit.amount }, $set: { lastUpdated: now } },
      { session }
    );
  });
};

export = {
  addDepositForUser,
  getMonthlyDepositForCurrentUser,
  listDeposits,
  updateDepositById,
  deleteDepositById
};

