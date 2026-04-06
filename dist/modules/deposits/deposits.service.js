"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const { ObjectId } = require('mongodb');
const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');
const addDepositForUser = async ({ userId, amount, month, depositDate, notes }, managerId) => {
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
    const { users, deposits, memberBalances } = await getCollections();
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) {
        throw createHttpError(404, 'User not found');
    }
    const deposit = {
        userId,
        amount,
        month,
        depositDate: depositDate ? new Date(depositDate) : new Date(),
        notes: notes || '',
        addedBy: managerId,
        createdAt: new Date()
    };
    const result = await deposits.insertOne(deposit);
    const existingBalance = await memberBalances.findOne({ userId });
    if (existingBalance) {
        await memberBalances.updateOne({ userId }, { $inc: { balance: amount }, $set: { lastUpdated: new Date() } });
    }
    else {
        await memberBalances.insertOne({
            userId,
            balance: amount,
            lastUpdated: new Date(),
            createdAt: new Date()
        });
    }
    return {
        depositId: result.insertedId,
        deposit: { ...deposit, _id: result.insertedId }
    };
};
const getMonthlyDepositForCurrentUser = async (userId, month) => {
    const { users, deposits } = await getCollections();
    const [aggregation] = await deposits.aggregate([
        { $match: { userId, month } },
        { $group: { _id: null, total: { $sum: '$amount' }, lastUpdated: { $max: '$depositDate' } } }
    ]).toArray();
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) {
        throw createHttpError(404, 'User not found');
    }
    return {
        userId,
        userName: user.name,
        email: user.email,
        month,
        deposit: aggregation?.total ?? 0,
        lastUpdated: aggregation?.lastUpdated ?? null
    };
};
const listDeposits = async ({ month, userId }) => {
    const query = {};
    if (month)
        query.month = month;
    if (userId)
        query.userId = userId;
    const { users, deposits } = await getCollections();
    const allDeposits = await deposits.find(query).sort({ depositDate: -1 }).toArray();
    const userIds = [...new Set(allDeposits.map(deposit => deposit.userId))]
        .filter(id => ObjectId.isValid(id))
        .map(id => new ObjectId(id));
    const usersList = await users.find({ _id: { $in: userIds } }).toArray();
    const usersMap = {};
    for (const user of usersList) {
        usersMap[user._id.toString()] = user;
    }
    let totalDeposit = 0;
    const depositsWithUsers = allDeposits.map(deposit => {
        totalDeposit += deposit.amount;
        const user = usersMap[deposit.userId];
        return { ...deposit, userName: user?.name, userEmail: user?.email };
    });
    return { count: depositsWithUsers.length, totalDeposit, deposits: depositsWithUsers };
};
const updateDepositById = async (depositId, { amount, month, depositDate, notes }) => {
    if (!ObjectId.isValid(depositId)) {
        throw createHttpError(400, 'Invalid deposit ID');
    }
    const { deposits, memberBalances, monthlyFinalization } = await getCollections();
    const existingDeposit = await deposits.findOne({ _id: new ObjectId(depositId) });
    if (!existingDeposit) {
        throw createHttpError(404, 'Deposit not found');
    }
    if (month && month !== existingDeposit.month) {
        const finalized = await monthlyFinalization.findOne({ month: existingDeposit.month });
        if (finalized) {
            throw createHttpError(400, 'Cannot update deposit - month is already finalized');
        }
    }
    const oldAmount = existingDeposit.amount;
    const newAmount = amount !== undefined ? amount : oldAmount;
    const amountDifference = newAmount - oldAmount;
    const updateData = { updatedAt: new Date() };
    if (amount !== undefined)
        updateData.amount = amount;
    if (month !== undefined)
        updateData.month = month;
    if (depositDate !== undefined)
        updateData.depositDate = new Date(depositDate);
    if (notes !== undefined)
        updateData.notes = notes;
    await deposits.updateOne({ _id: new ObjectId(depositId) }, { $set: updateData });
    if (amountDifference !== 0) {
        await memberBalances.updateOne({ userId: existingDeposit.userId }, { $inc: { balance: amountDifference }, $set: { lastUpdated: new Date() } });
    }
};
const deleteDepositById = async (depositId) => {
    if (!ObjectId.isValid(depositId)) {
        throw createHttpError(400, 'Invalid deposit ID');
    }
    const { deposits, memberBalances, monthlyFinalization } = await getCollections();
    const existingDeposit = await deposits.findOne({ _id: new ObjectId(depositId) });
    if (!existingDeposit) {
        throw createHttpError(404, 'Deposit not found');
    }
    const finalized = await monthlyFinalization.findOne({ month: existingDeposit.month });
    if (finalized) {
        throw createHttpError(400, 'Cannot delete deposit - month is already finalized');
    }
    await deposits.deleteOne({ _id: new ObjectId(depositId) });
    await memberBalances.updateOne({ userId: existingDeposit.userId }, { $inc: { balance: -existingDeposit.amount }, $set: { lastUpdated: new Date() } });
};
module.exports = {
    addDepositForUser,
    getMonthlyDepositForCurrentUser,
    listDeposits,
    updateDepositById,
    deleteDepositById
};
