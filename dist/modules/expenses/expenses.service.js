"use strict";
const mongodb_1 = require("mongodb");
const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');
const { formatServiceDate, getCurrentServiceDate, getServiceMonth, normalizeBusinessDateFields, serviceDateToLegacyDate } = require('../shared/date.utils');
const { assertMonthIsNotFinalized } = require('../shared/service-rules');
const buildCanonicalServiceDateRangeQuery = (startDate, endDate) => ({
    serviceDate: { $gte: startDate, $lte: endDate }
});
const addExpenseEntry = async ({ date, category, amount, description, person }, managerId) => {
    if (!date || !category || !amount) {
        throw createHttpError(400, 'date, category, and amount are required');
    }
    if (typeof amount !== 'number' || amount <= 0) {
        throw createHttpError(400, 'amount must be a positive number');
    }
    const { expenses } = await getCollections();
    const serviceDate = formatServiceDate(date);
    const todayServiceDate = getCurrentServiceDate();
    const expense = {
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
const listExpenses = async ({ startDate, endDate, category }) => {
    const query = {};
    if (startDate && endDate) {
        Object.assign(query, buildCanonicalServiceDateRangeQuery(startDate, endDate));
    }
    if (category)
        query.category = category;
    const { users, expenses } = await getCollections();
    const allExpenses = await expenses.find(query).sort({ serviceDate: -1, createdAt: -1 }).toArray();
    const managerIds = [...new Set(allExpenses.map(expense => expense.addedBy?.toString()).filter(id => id && mongodb_1.ObjectId.isValid(id)))]
        .map(id => new mongodb_1.ObjectId(id));
    const managersList = await users.find({ _id: { $in: managerIds } }).toArray();
    const managersMap = {};
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
const updateExpenseById = async (expenseId, { date, category, amount, description, person }) => {
    if (!mongodb_1.ObjectId.isValid(expenseId)) {
        throw createHttpError(400, 'Invalid expense ID');
    }
    const { expenses, monthlyFinalization } = await getCollections();
    const existingExpense = await expenses.findOne({ _id: new mongodb_1.ObjectId(expenseId) });
    if (!existingExpense) {
        throw createHttpError(404, 'Expense not found');
    }
    const expenseMonth = getServiceMonth(existingExpense.serviceDate);
    await assertMonthIsNotFinalized(monthlyFinalization, expenseMonth);
    const updateData = { updatedAt: new Date(), updatedDate: getCurrentServiceDate() };
    if (date !== undefined) {
        const serviceDate = formatServiceDate(date);
        updateData.date = serviceDateToLegacyDate(serviceDate);
        updateData.serviceDate = serviceDate;
    }
    if (category !== undefined)
        updateData.category = category;
    if (amount !== undefined)
        updateData.amount = amount;
    if (description !== undefined)
        updateData.description = description;
    if (person !== undefined)
        updateData.person = person;
    await expenses.updateOne({ _id: new mongodb_1.ObjectId(expenseId) }, { $set: updateData });
};
const deleteExpenseById = async (expenseId) => {
    if (!mongodb_1.ObjectId.isValid(expenseId)) {
        throw createHttpError(400, 'Invalid expense ID');
    }
    const { expenses, monthlyFinalization } = await getCollections();
    const existingExpense = await expenses.findOne({ _id: new mongodb_1.ObjectId(expenseId) });
    if (!existingExpense) {
        throw createHttpError(404, 'Expense not found');
    }
    const expenseMonth = getServiceMonth(existingExpense.serviceDate);
    await assertMonthIsNotFinalized(monthlyFinalization, expenseMonth);
    await expenses.deleteOne({ _id: new mongodb_1.ObjectId(expenseId) });
};
module.exports = {
    addExpenseEntry,
    listExpenses,
    updateExpenseById,
    deleteExpenseById
};
