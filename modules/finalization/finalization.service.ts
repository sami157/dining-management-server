import type { ClientSession, ObjectId } from 'mongodb';
const { getCollections, withMongoTransaction } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');
const {
  formatServiceDate,
  getCurrentServiceDate,
  getMonthServiceDateRange
} = require('../shared/date.utils');

type UserRecord = {
  _id: ObjectId;
  name: string;
  mosqueFee?: number;
};

type MealScheduleRecord = {
  serviceDate: string;
  availableMeals: Array<{
    mealType: string;
    weight?: number;
  }>;
};

type MealRegistrationRecord = {
  userId: { toString(): string };
  serviceDate: string;
  mealType: string;
  numberOfMeals?: number;
};

type DepositRecord = {
  userId: { toString(): string };
  amount: number;
};

type BalanceRecord = {
  userId: string;
  balance?: number;
};

type ExpenseRecord = {
  category: string;
  amount: number;
};

type MemberDetail = {
  userId: string;
  userName: string;
  totalMeals: number;
  totalDeposits: number;
  mealCost: number;
  mosqueFee: number;
  previousBalance: number;
  newBalance: number;
  status: string;
};

type FinalizationRecord = {
  _id?: ObjectId;
  month: string;
  finalizedAt: Date;
  finalizedDate?: string;
  finalizedBy?: unknown;
  totalMembers: number;
  totalMealsServed: number;
  totalDeposits: number;
  totalExpenses: number;
  mealRate: number;
  memberDetails: MemberDetail[];
  expenseBreakdown: Array<{ category: string; amount: number }>;
  isFinalized: boolean;
  notes: string;
};

const buildCanonicalServiceDateRangeQuery = (startDate: string, endDate: string) => ({
  serviceDate: { $gte: startDate, $lte: endDate }
});

const finalizeMonthSummary = async (month: string, managerId: unknown) => {
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!month || !monthRegex.test(month)) {
    throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
  }

  return withMongoTransaction(async (session: ClientSession) => {
    const {
      users, mealRegistrations, mealSchedules,
      deposits, memberBalances, expenses, monthlyFinalization
    } = await getCollections();

    const existingFinalization = await monthlyFinalization.findOne({ month }, { session }) as FinalizationRecord | null;
    if (existingFinalization) {
      throw createHttpError(400, 'This month has already been finalized');
    }

    const { startServiceDate, endServiceDate } = getMonthServiceDateRange(month);

    const [allUsers, allRegistrations, allSchedules, allDeposits, allBalances, monthExpenses] =
      await Promise.all([
        users.find({ isActive: { $ne: false } }, { session }).toArray() as Promise<UserRecord[]>,
        mealRegistrations.find(buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate), { session }).toArray() as Promise<MealRegistrationRecord[]>,
        mealSchedules.find(buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate), { session }).toArray() as Promise<MealScheduleRecord[]>,
        deposits.find({ month }, { session }).toArray() as Promise<DepositRecord[]>,
        memberBalances.find({}, { session }).toArray() as Promise<BalanceRecord[]>,
        expenses.find(buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate), { session }).toArray() as Promise<ExpenseRecord[]>
      ]);

    const scheduleMap: Record<string, MealScheduleRecord> = {};
    for (const schedule of allSchedules) {
      scheduleMap[schedule.serviceDate] = schedule;
    }

    const registrationsByUser: Record<string, MealRegistrationRecord[]> = {};
    for (const registration of allRegistrations) {
      if (!registration.userId) continue;
      const uid = registration.userId.toString();
      if (!registrationsByUser[uid]) registrationsByUser[uid] = [];
      registrationsByUser[uid].push(registration);
    }

    const depositsByUser: Record<string, number> = {};
    for (const deposit of allDeposits) {
      if (!deposit.userId) continue;
      const uid = deposit.userId.toString();
      depositsByUser[uid] = (depositsByUser[uid] || 0) + deposit.amount;
    }

    const balanceByUser: Record<string, number> = {};
    for (const balance of allBalances) {
      if (!balance.userId) continue;
      balanceByUser[balance.userId.toString()] = balance.balance || 0;
    }

    const totalExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const expenseBreakdown: Record<string, number> = {};
    for (const expense of monthExpenses) {
      expenseBreakdown[expense.category] = (expenseBreakdown[expense.category] || 0) + expense.amount;
    }
    const expenseBreakdownArray = Object.entries(expenseBreakdown).map(([category, amount]) => ({ category, amount }));

    const userMealsMap: Record<string, number> = {};
    let totalMealsServed = 0;

    for (const user of allUsers) {
      const userId = user._id.toString();
      const userRegistrations = registrationsByUser[userId] || [];
      let userTotalMeals = 0;

      for (const registration of userRegistrations) {
        const schedule = scheduleMap[registration.serviceDate];
        if (!schedule) continue;

        const meal = schedule.availableMeals.find(item => item.mealType === registration.mealType);
        const weight = meal?.weight || 1;
        const numberOfMeals = registration.numberOfMeals || 1;
        userTotalMeals += numberOfMeals * weight;
      }

      userMealsMap[userId] = userTotalMeals;
      totalMealsServed += userTotalMeals;
    }

    const mealRate = totalMealsServed > 0
      ? parseFloat((totalExpenses / totalMealsServed).toFixed(2))
      : 0;
    const totalDeposits = Object.values(depositsByUser).reduce((sum, amount) => sum + amount, 0);

    const memberDetails: MemberDetail[] = [];
    const balanceUpdates: Array<{
      updateOne: {
        filter: { userId: string };
        update: {
          $set: { balance: number; lastUpdated: Date };
          $setOnInsert: { createdAt: Date };
        };
        upsert: true;
      };
    }> = [];
    const now = new Date();

    for (const user of allUsers) {
      const userId = user._id.toString();
      const totalMeals = userMealsMap[userId] || 0;
      const totalUserDeposits = depositsByUser[userId] || 0;
      const mealCost = totalMeals * mealRate;
      const previousBalance = balanceByUser[userId] || 0;
      const mosqueFee = user.mosqueFee || 0;
      const newBalance = previousBalance - mealCost - mosqueFee;

      let status = 'paid';
      if (newBalance < 0) status = 'due';
      if (newBalance > 0) status = 'advance';

      memberDetails.push({
        userId,
        userName: user.name,
        totalMeals,
        totalDeposits: totalUserDeposits,
        mealCost,
        mosqueFee,
        previousBalance,
        newBalance,
        status
      });

      balanceUpdates.push({
        updateOne: {
          filter: { userId },
          update: {
            $set: { balance: newBalance, lastUpdated: now },
            $setOnInsert: { createdAt: now }
          },
          upsert: true
        }
      });
    }

    if (balanceUpdates.length > 0) {
      await memberBalances.bulkWrite(balanceUpdates, { session });
    }

    const finalizationRecord: FinalizationRecord = {
      month,
      finalizedAt: now,
      finalizedDate: getCurrentServiceDate(),
      finalizedBy: managerId,
      totalMembers: allUsers.length,
      totalMealsServed,
      totalDeposits,
      totalExpenses,
      mealRate,
      memberDetails,
      expenseBreakdown: expenseBreakdownArray,
      isFinalized: true,
      notes: ''
    };

    const result = await monthlyFinalization.insertOne(finalizationRecord, { session });
    return {
      finalizationId: result.insertedId,
      summary: {
        month,
        totalMembers: allUsers.length,
        totalMealsServed,
        totalDeposits,
        totalExpenses,
        mealRate: parseFloat(mealRate.toFixed(2))
      }
    };
  });
};

const getFinalizationByMonth = async (month: string) => {
  const { monthlyFinalization } = await getCollections();
  const finalization = await monthlyFinalization.findOne({ month }) as FinalizationRecord | null;

  if (!finalization) {
    throw createHttpError(404, 'Finalization not found for this month');
  }

  return {
    finalization: {
      ...finalization,
      finalizedDate: finalization.finalizedDate || formatServiceDate(finalization.finalizedAt)
    }
  };
};

const getCurrentUserFinalization = async (userId: string, month: string) => {
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!month || !monthRegex.test(month)) {
    throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
  }

  const { monthlyFinalization } = await getCollections();
  const record = await monthlyFinalization.findOne(
    { month },
    { projection: { month: 1, finalizedAt: 1, mealRate: 1, totalMealsServed: 1, totalExpenses: 1, memberDetails: 1 } }
  ) as FinalizationRecord | null;

  if (!record) {
    throw createHttpError(404, 'No finalization record found for this month');
  }

  const myDetails = record.memberDetails?.find(member => member.userId === userId);
  if (!myDetails) {
    throw createHttpError(404, 'No data found for this user in the specified month');
  }

  return {
    finalization: {
      month: record.month,
      finalizedAt: record.finalizedAt,
      finalizedDate: record.finalizedDate || formatServiceDate(record.finalizedAt),
      mealRate: record.mealRate,
      totalMealsServed: record.totalMealsServed,
      totalExpenses: record.totalExpenses,
      ...myDetails
    }
  };
};

const listFinalizations = async () => {
  const { monthlyFinalization } = await getCollections();
  const finalizations = await monthlyFinalization.find({}).sort({ month: -1 }).toArray() as FinalizationRecord[];
  return {
    count: finalizations.length,
    finalizations: finalizations.map((item) => ({
      ...item,
      finalizedDate: item.finalizedDate || formatServiceDate(item.finalizedAt)
    }))
  };
};

const undoFinalizationByMonth = async (month: string) => {
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!month || !monthRegex.test(month)) {
    throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
  }

  return withMongoTransaction(async (session: ClientSession) => {
    const { memberBalances, monthlyFinalization } = await getCollections();
    const finalizationRecord = await monthlyFinalization.findOne({ month }, { session }) as FinalizationRecord | null;
    if (!finalizationRecord) {
      throw createHttpError(404, 'No finalization record found for this month');
    }

    const [year, monthNum] = month.split('-').map(Number);
    const nextMonthDate = new Date(year, monthNum, 1);
    const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const laterFinalization = await monthlyFinalization.findOne({ month: { $gte: nextMonthStr } }, { session }) as FinalizationRecord | null;
    if (laterFinalization) {
      throw createHttpError(400, `Cannot undo finalization for ${month} because ${laterFinalization.month} has already been finalized. You must undo that month first.`);
    }

    const now = new Date();
    const balanceRestores = finalizationRecord.memberDetails.map(member => ({
      updateOne: {
        filter: { userId: member.userId },
        update: {
          $set: { balance: member.previousBalance, lastUpdated: now },
          $setOnInsert: { createdAt: now }
        },
        upsert: true
      }
    }));

    if (balanceRestores.length > 0) {
      await memberBalances.bulkWrite(balanceRestores, { session });
    }

    await monthlyFinalization.deleteOne({ month }, { session });
    return { restoredMembers: finalizationRecord.memberDetails.length };
  });
};

export = {
  finalizeMonthSummary,
  getFinalizationByMonth,
  getCurrentUserFinalization,
  listFinalizations,
  undoFinalizationByMonth
};

