"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const { addExpenseEntry, listExpenses, updateExpenseById, deleteExpenseById } = require('./expenses.service');
const { asyncHandler } = require('../shared/controller.utils');
const addExpense = asyncHandler(async (req, res) => {
    const result = await addExpenseEntry(req.body, req.user?._id);
    return res.status(201).json({
        message: 'Expense added successfully',
        expenseId: result.expenseId,
        expense: result.expense
    });
});
const getAllExpenses = asyncHandler(async (req, res) => {
    const result = await listExpenses(req.query);
    return res.status(200).json(result);
});
const updateExpense = asyncHandler(async (req, res) => {
    await updateExpenseById(req.params.expenseId, req.body);
    return res.status(200).json({ message: 'Expense updated successfully' });
});
const deleteExpense = asyncHandler(async (req, res) => {
    await deleteExpenseById(req.params.expenseId);
    return res.status(200).json({ message: 'Expense deleted successfully' });
});
module.exports = {
    addExpense,
    getAllExpenses,
    updateExpense,
    deleteExpense
};
