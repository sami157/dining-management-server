const { ObjectId } = require('mongodb');
const { format } = require('date-fns');
const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');

const addExpenseEntry = async ({ date, category, amount, description, person }, managerId) => {
  if (!date || !category || !amount) {
    throw createHttpError(400, 'date, category, and amount are required');
  }

  if (typeof amount !== 'number' || amount <= 0) {
    throw createHttpError(400, 'amount must be a positive number');
  }

  const { expenses } = await getCollections();
  const expense = {
    date: new Date(date),
    category,
    amount,
    description: description || '',
    person: person || '',
    addedBy: managerId,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await expenses.insertOne(expense);
  return { expenseId: result.insertedId, expense: { ...expense, _id: result.insertedId } };
};

const listExpenses = async ({ startDate, endDate, category }) => {
  const query = {};
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    query.date = { $gte: start, $lte: end };
  }
  if (category) query.category = category;

  const { users, expenses } = await getCollections();
  const allExpenses = await expenses.find(query).sort({ date: -1 }).toArray();

  const managerIds = [...new Set(allExpenses.map(expense => expense.addedBy?.toString()).filter(id => id && ObjectId.isValid(id)))]
    .map(id => new ObjectId(id));

  const managersList = await users.find({ _id: { $in: managerIds } }).toArray();
  const managersMap = {};
  for (const manager of managersList) {
    managersMap[manager._id.toString()] = manager;
  }

  const expensesWithManagers = allExpenses.map(expense => ({
    ...expense,
    addedByName: managersMap[expense.addedBy?.toString()]?.name || 'Unknown'
  }));

  return { count: expensesWithManagers.length, expenses: expensesWithManagers };
};

const updateExpenseById = async (expenseId, { date, category, amount, description, person }) => {
  if (!ObjectId.isValid(expenseId)) {
    throw createHttpError(400, 'Invalid expense ID');
  }

  const { expenses, monthlyFinalization } = await getCollections();
  const existingExpense = await expenses.findOne({ _id: new ObjectId(expenseId) });
  if (!existingExpense) {
    throw createHttpError(404, 'Expense not found');
  }

  const expenseMonth = format(existingExpense.date, 'yyyy-MM');
  const finalized = await monthlyFinalization.findOne({ month: expenseMonth });
  if (finalized) {
    throw createHttpError(400, 'Cannot update expense - month is already finalized');
  }

  const updateData = { updatedAt: new Date() };
  if (date !== undefined) {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    updateData.date = newDate;
  }
  if (category !== undefined) updateData.category = category;
  if (amount !== undefined) updateData.amount = amount;
  if (description !== undefined) updateData.description = description;
  if (person !== undefined) updateData.person = person;

  await expenses.updateOne({ _id: new ObjectId(expenseId) }, { $set: updateData });
};

const deleteExpenseById = async (expenseId) => {
  if (!ObjectId.isValid(expenseId)) {
    throw createHttpError(400, 'Invalid expense ID');
  }

  const { expenses, monthlyFinalization } = await getCollections();
  const existingExpense = await expenses.findOne({ _id: new ObjectId(expenseId) });
  if (!existingExpense) {
    throw createHttpError(404, 'Expense not found');
  }

  const expenseMonth = format(existingExpense.date, 'yyyy-MM');
  const finalized = await monthlyFinalization.findOne({ month: expenseMonth });
  if (finalized) {
    throw createHttpError(400, 'Cannot delete expense - month is already finalized');
  }

  await expenses.deleteOne({ _id: new ObjectId(expenseId) });
};

module.exports = {
  addExpenseEntry,
  listExpenses,
  updateExpenseById,
  deleteExpenseById
};
