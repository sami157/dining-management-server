"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const { ObjectId } = require('mongodb');
const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('./finance.utils');
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
    const { users, memberBalances } = await getCollections();
    const balance = await memberBalances.findOne({ userId });
    if (!balance) {
        const user = await users.findOne({ _id: new ObjectId(userId) });
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
    const user = await users.findOne({ _id: new ObjectId(balance.userId) });
    return {
        userId: balance.userId,
        userName: user?.name || 'Unknown',
        email: user?.email || '',
        balance: balance.balance,
        lastUpdated: balance.lastUpdated
    };
};
const getBalanceForCurrentUser = async (currentUserId) => {
    const userId = currentUserId.toString();
    const { users, memberBalances } = await getCollections();
    const balance = await memberBalances.findOne({ userId });
    if (!balance) {
        const user = await users.findOne({ _id: new ObjectId(userId) });
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
    const user = await users.findOne({ _id: new ObjectId(balance.userId) });
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
