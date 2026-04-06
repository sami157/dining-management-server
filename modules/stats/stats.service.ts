const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');
const {
  formatServiceDate,
  getMonthServiceDateRange
} = require('../shared/date.utils');
import type { RunningMealRateQuery } from './stats.validation';

const buildCanonicalServiceDateRangeQuery = (startDate: string, endDate: string) => ({
  serviceDate: { $gte: startDate, $lte: endDate }
});

type MealSchedule = {
  serviceDate: string;
  availableMeals?: Array<{
    mealType: string;
    weight?: number;
  }>;
};

type MealRegistration = {
  serviceDate: string;
  mealType: string;
  numberOfMeals?: number;
};

type Expense = {
  amount: number;
};

type FinalizationRecord = {
  month: string;
  mealRate: number;
  totalMealsServed: number;
  totalExpenses: number;
};

type RunningMealRateSummary = {
  month: string;
  asOf: string;
  totalMealsServed: number;
  totalExpenses: number;
  mealRate: number;
};

const getRunningMealRateSummary = async ({
  month,
  date
}: RunningMealRateQuery): Promise<RunningMealRateSummary> => {
  const targetServiceDate = date || formatServiceDate();
  const { startServiceDate, endServiceDate: monthEndServiceDate } = getMonthServiceDateRange(month);

  const { users, mealRegistrations, mealSchedules, expenses, monthlyFinalization } = await getCollections();
  const finalizedMonth = await monthlyFinalization.findOne({ month });

  if (finalizedMonth) {
    const finalization = finalizedMonth as FinalizationRecord;

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

  const scheduleMap: Record<string, MealSchedule> = {};
  for (const schedule of allSchedules as MealSchedule[]) {
    scheduleMap[schedule.serviceDate] = schedule;
  }

  let totalMealsServed = 0;
  for (const registration of allRegistrations as MealRegistration[]) {
    const schedule = scheduleMap[registration.serviceDate];
    if (!schedule) {
      continue;
    }

    const meal = schedule.availableMeals?.find((item) => item.mealType === registration.mealType);
    const weight = meal?.weight || 1;
    const numberOfMeals = registration.numberOfMeals || 1;
    totalMealsServed += numberOfMeals * weight;
  }

  const totalExpenses = (monthExpenses as Expense[]).reduce((sum, expense) => sum + expense.amount, 0);
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

export {
  getRunningMealRateSummary
};
