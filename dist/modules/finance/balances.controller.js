"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyBalance = exports.getUserBalance = exports.getAllBalances = void 0;
const { listBalances, getBalanceByUserId, getBalanceForCurrentUser } = require('./balances.service');
const { asyncHandler } = require('../shared/controller.utils');
const getAllBalances = asyncHandler(async (req, res) => {
    const result = await listBalances();
    return res.status(200).json(result);
});
exports.getAllBalances = getAllBalances;
const getUserBalance = asyncHandler(async (req, res) => {
    const result = await getBalanceByUserId(req.params.userId);
    return res.status(200).json(result);
});
exports.getUserBalance = getUserBalance;
const getMyBalance = asyncHandler(async (req, res) => {
    const result = await getBalanceForCurrentUser(req.user?._id);
    return res.status(200).json(result);
});
exports.getMyBalance = getMyBalance;
