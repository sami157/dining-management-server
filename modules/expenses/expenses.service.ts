import { ObjectId } from 'mongodb';
const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');
const {
  formatServiceDate,
  getCurrentServiceDate,
  getServiceMonth,
  normalizeBusinessDateFields,
  serviceDateToLegacyDate
} = require('../shared/date.utils');
const { assertMonthIsNotFinalized } = require('../shared/service-rules');

type ExpenseRecord = {
  _id?: ObjectId;
  date: Date;
  serviceDate: string;
  category: string;
  amount: number;
  description: string;
  person: string;
  addedBy?: ObjectId | string;
  createdAt: Date;
  createdDate: string;
  updatedAt: Date;
  updatedDate: string;
};

type UserSummary = {
  _id: ObjectId;
  name?: string;
};

type ExpensePayload = {
  date?: string;
  category?: string;
  amount?: number;
  description?: string;
  person?: string;
};

type ExpenseListQuery = {
  serviceDate?: {
    $gte: string;
    $lte: string;
  };
  category?: string;
};

const buildCanonicalServiceDateRangeQuery = (startDate: string, endDate: string) => ({
  serviceDate: { $gte: startDate, $lte: endDate }
});

const addExpenseEntry = async ({ date, category, amount, description, person }: ExpensePayload, managerId: ObjectId | string | undefined) => {
  if (!date || !category || !amount) {
    throw createHttpError(400, 'date, category, and amount are required');
  }

  if (typeof amount !== 'number' || amount <= 0) {
    throw createHttpError(400, 'amount must be a positive number');
  }

  const { expenses } = await getCollections();
  const serviceDate = formatServiceDate(date);
  const todayServiceDate = getCurrentServiceDate();
  const expense: ExpenseRecord = {
    date: serviceDateToLegacyDate(serviceDate),
    serviceDate,
    category,
    amount,
    description: description || '',
    person: person || '',
    addedBy: managerId,
    createdAt: new Date(),
    createdDate: todayServiceDate,
    updatedAt: new Date(),
    updatedDate: todayServiceDate
  };

  const result = await expenses.insertOne(expense);
  return { expenseId: result.insertedId, expense: { ...expense, _id: result.insertedId } };
};

const listExpenses = async ({ startDate, endDate, category }: { startDate?: string; endDate?: string; category?: string }) => {
  const query: ExpenseListQuery = {};
  if (startDate && endDate) {
    Object.assign(query, buildCanonicalServiceDateRangeQuery(startDate, endDate));
  }
  if (category) query.category = category;

  const { users, expenses } = await getCollections();
  const allExpenses = await expenses.find(query).sort({ serviceDate: -1, createdAt: -1 }).toArray() as ExpenseRecord[];

  const managerIds = [...new Set(allExpenses.map(expense => expense.addedBy?.toString()).filter(id => id && ObjectId.isValid(id)))]
    .map(id => new ObjectId(id));

  const managersList = await users.find({ _id: { $in: managerIds } }).toArray() as UserSummary[];
  const managersMap: Record<string, UserSummary> = {};
  for (const manager of managersList) {
    managersMap[manager._id.toString()] = manager;
  }

  const expensesWithManagers = allExpenses.map(expense => ({
    ...normalizeBusinessDateFields(expense),
    createdDate: expense.createdDate,
    updatedDate: expense.updatedDate,
    addedByName: managersMap[expense.addedBy?.toString()]?.name || 'Unknown'
  }));

  return { count: expensesWithManagers.length, expenses: expensesWithManagers };
};

const updateExpenseById = async (expenseId: string, { date, category, amount, description, person }: ExpensePayload) => {
  if (!ObjectId.isValid(expenseId)) {
    throw createHttpError(400, 'Invalid expense ID');
  }

  const { expenses, monthlyFinalization } = await getCollections();
  const existingExpense = await expenses.findOne({ _id: new ObjectId(expenseId) }) as ExpenseRecord | null;
  if (!existingExpense) {
    throw createHttpError(404, 'Expense not found');
  }

  const expenseMonth = getServiceMonth(existingExpense.serviceDate);
  await assertMonthIsNotFinalized(monthlyFinalization, expenseMonth);

  const updateData: Partial<ExpenseRecord> = { updatedAt: new Date(), updatedDate: getCurrentServiceDate() };
  if (date !== undefined) {
    const serviceDate = formatServiceDate(date);
    updateData.date = serviceDateToLegacyDate(serviceDate);
    updateData.serviceDate = serviceDate;
  }
  if (category !== undefined) updateData.category = category;
  if (amount !== undefined) updateData.amount = amount;
  if (description !== undefined) updateData.description = description;
  if (person !== undefined) updateData.person = person;

  await expenses.updateOne({ _id: new ObjectId(expenseId) }, { $set: updateData });
};

const deleteExpenseById = async (expenseId: string) => {
  if (!ObjectId.isValid(expenseId)) {
    throw createHttpError(400, 'Invalid expense ID');
  }

  const { expenses, monthlyFinalization } = await getCollections();
  const existingExpense = await expenses.findOne({ _id: new ObjectId(expenseId) }) as ExpenseRecord | null;
  if (!existingExpense) {
    throw createHttpError(404, 'Expense not found');
  }

  const expenseMonth = getServiceMonth(existingExpense.serviceDate);
  await assertMonthIsNotFinalized(monthlyFinalization, expenseMonth);

  await expenses.deleteOne({ _id: new ObjectId(expenseId) });
};

export = {
  addExpenseEntry,
  listExpenses,
  updateExpenseById,
  deleteExpenseById
};

