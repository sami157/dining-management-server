"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpense = exports.updateExpense = exports.getAllExpenses = exports.addExpense = void 0;
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
exports.addExpense = addExpense;
const getAllExpenses = asyncHandler(async (req, res) => {
    const result = await listExpenses(req.query);
    return res.status(200).json(result);
});
exports.getAllExpenses = getAllExpenses;
const updateExpense = asyncHandler(async (req, res) => {
    await updateExpenseById(req.params.expenseId, req.body);
    return res.status(200).json({ message: 'Expense updated successfully' });
});
exports.updateExpense = updateExpense;
const deleteExpense = asyncHandler(async (req, res) => {
    await deleteExpenseById(req.params.expenseId);
    return res.status(200).json({ message: 'Expense deleted successfully' });
});
exports.deleteExpense = deleteExpense;
