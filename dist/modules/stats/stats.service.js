"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRunningMealRateSummary = void 0;
const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');
const { formatServiceDate, getMonthServiceDateRange } = require('../shared/date.utils');
const buildCanonicalServiceDateRangeQuery = (startDate, endDate) => ({
    serviceDate: { $gte: startDate, $lte: endDate }
});
const getRunningMealRateSummary = async ({ month, date }) => {
    const targetServiceDate = date || formatServiceDate();
    const { startServiceDate, endServiceDate: monthEndServiceDate } = getMonthServiceDateRange(month);
    const { users, mealRegistrations, mealSchedules, expenses, monthlyFinalization } = await getCollections();
    const finalizedMonth = await monthlyFinalization.findOne({ month });
    if (finalizedMonth) {
        const finalization = finalizedMonth;
        return {
            month,
            asOf: monthEndServiceDate,
            totalMealsServed: finalization.totalMealsServed || 0,
            totalExpenses: finalization.totalExpenses || 0,
            mealRate: Number((finalization.mealRate || 0).toFixed(2))
        };
    }
    const [, allRegistrations, allSchedules, monthExpenses] = await Promise.all([
        users.find({ isActive: { $ne: false } }).toArray(),
        mealRegistrations.find(buildCanonicalServiceDateRangeQuery(startServiceDate, targetServiceDate)).toArray(),
        mealSchedules.find(buildCanonicalServiceDateRangeQuery(startServiceDate, targetServiceDate)).toArray(),
        expenses.find(buildCanonicalServiceDateRangeQuery(startServiceDate, targetServiceDate)).toArray()
    ]);
    const scheduleMap = {};
    for (const schedule of allSchedules) {
        scheduleMap[schedule.serviceDate] = schedule;
    }
    let totalMealsServed = 0;
    for (const registration of allRegistrations) {
        const schedule = scheduleMap[registration.serviceDate];
        if (!schedule) {
            continue;
        }
        const meal = schedule.availableMeals?.find((item) => item.mealType === registration.mealType);
        const weight = meal?.weight || 1;
        const numberOfMeals = registration.numberOfMeals || 1;
        totalMealsServed += numberOfMeals * weight;
    }
    const totalExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const mealRate = totalMealsServed > 0
        ? Number((totalExpenses / totalMealsServed).toFixed(2))
        : 0;
    return {
        month,
        asOf: targetServiceDate,
        totalMealsServed,
        totalExpenses,
        mealRate: Number(mealRate.toFixed(2))
    };
};
exports.getRunningMealRateSummary = getRunningMealRateSummary;
