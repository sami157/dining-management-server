"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const { listBalances, getBalanceByUserId, getBalanceForCurrentUser } = require('./balances.service');
const { asyncHandler } = require('../shared/controller.utils');
const getAllBalances = asyncHandler(async (req, res) => {
    const result = await listBalances();
    return res.status(200).json(result);
});
const getUserBalance = asyncHandler(async (req, res) => {
    const result = await getBalanceByUserId(req.params.userId);
    return res.status(200).json(result);
});
const getMyBalance = asyncHandler(async (req, res) => {
    const result = await getBalanceForCurrentUser(req.user?._id);
    return res.status(200).json(result);
});
module.exports = {
    getAllBalances,
    getUserBalance,
    getMyBalance
};
