import type { Request, Response } from 'express';
const {
  addExpenseEntry,
  listExpenses,
  updateExpenseById,
  deleteExpenseById
} = require('./expenses.service');
const { asyncHandler } = require('../shared/controller.utils');

const addExpense = asyncHandler(async (req: Request, res: Response) => {
  const result = await addExpenseEntry(req.body, req.user?._id);
  return res.status(201).json({
    message: 'Expense added successfully',
    expenseId: result.expenseId,
    expense: result.expense
  });
});

const getAllExpenses = asyncHandler(async (req: Request, res: Response) => {
  const result = await listExpenses(req.query);
  return res.status(200).json(result);
});

const updateExpense = asyncHandler(async (req: Request, res: Response) => {
  await updateExpenseById(req.params.expenseId, req.body);
  return res.status(200).json({ message: 'Expense updated successfully' });
});

const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  await deleteExpenseById(req.params.expenseId);
  return res.status(200).json({ message: 'Expense deleted successfully' });
});

export {
  addExpense,
  getAllExpenses,
  updateExpense,
  deleteExpense
};
