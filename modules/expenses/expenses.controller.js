const {
  addExpenseEntry,
  listExpenses,
  updateExpenseById,
  deleteExpenseById
} = require('./expenses.service');
const { handleControllerError } = require('../finance/finance.utils');

const addExpense = async (req, res) => {
  try {
    const result = await addExpenseEntry(req.body, req.user?._id);
    return res.status(201).json({
      message: 'Expense added successfully',
      expenseId: result.expenseId,
      expense: result.expense
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error adding expense:');
  }
};

const getAllExpenses = async (req, res) => {
  try {
    const result = await listExpenses(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Error fetching expenses:');
  }
};

const updateExpense = async (req, res) => {
  try {
    await updateExpenseById(req.params.expenseId, req.body);
    return res.status(200).json({ message: 'Expense updated successfully' });
  } catch (error) {
    return handleControllerError(res, error, 'Error updating expense:');
  }
};

const deleteExpense = async (req, res) => {
  try {
    await deleteExpenseById(req.params.expenseId);
    return res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (error) {
    return handleControllerError(res, error, 'Error deleting expense:');
  }
};

module.exports = {
  addExpense,
  getAllExpenses,
  updateExpense,
  deleteExpense
};
