const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');

const getRunningMealRateSummary = async ({ month, date }) => {
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!month || !monthRegex.test(month)) {
    throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
  }

  const targetDate = date ? new Date(date) : new Date();
  if (isNaN(targetDate.getTime())) {
    throw createHttpError(400, 'date must be a valid date string (e.g., 2025-01-15)');
  }

  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);

  const { users, mealRegistrations, mealSchedules, expenses } = await getCollections();
  const [, allRegistrations, allSchedules, monthExpenses] = await Promise.all([
    users.find({ isActive: { $ne: false } }).toArray(),
    mealRegistrations.find({ date: { $gte: startDate, $lte: endDate } }).toArray(),
    mealSchedules.find({ date: { $gte: startDate, $lte: endDate } }).toArray(),
    expenses.find({ date: { $gte: startDate, $lte: endDate } }).toArray()
  ]);

  const scheduleMap = {};
  for (const schedule of allSchedules) {
    scheduleMap[schedule.date.toISOString()] = schedule;
  }

  let totalMealsServed = 0;
  for (const registration of allRegistrations) {
    const schedule = scheduleMap[registration.date.toISOString()];
    if (!schedule) continue;

    const meal = schedule.availableMeals.find(item => item.mealType === registration.mealType);
    const weight = meal?.weight || 1;
    const numberOfMeals = registration.numberOfMeals || 1;
    totalMealsServed += numberOfMeals * weight;
  }

  const totalExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const mealRate = totalMealsServed > 0
    ? parseFloat((totalExpenses / totalMealsServed).toFixed(2))
    : 0;

  return {
    month,
    asOf: targetDate.toISOString().split('T')[0],
    totalMealsServed,
    totalExpenses,
    mealRate: parseFloat(mealRate.toFixed(2))
  };
};

module.exports = {
  getRunningMealRateSummary
};
