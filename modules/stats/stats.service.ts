import type { ObjectId } from 'mongodb';
import { DateTime } from 'luxon';
const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');
const {
  BUSINESS_TIMEZONE,
  formatServiceDate,
  getCurrentServiceDate,
  getMonthServiceDateRange
} = require('../shared/date.utils');
import type {
  AllTimeSummaryQuery,
  DashboardQuery,
  ExpenseTrendQuery,
  MealTrendQuery,
  MealTypeBreakdownQuery,
  MonthSummaryQuery,
  RunningMealRateQuery,
  TopMembersQuery,
  TwoDaySheetSummaryQuery
} from './stats.validation';

const buildCanonicalServiceDateRangeQuery = (startDate: string, endDate: string) => ({
  serviceDate: { $gte: startDate, $lte: endDate }
});

type MealSchedule = {
  serviceDate: string;
  isHoliday?: boolean;
  availableMeals?: Array<{
    mealType: string;
    weight?: number;
    isAvailable?: boolean;
  }>;
};

type MealRegistration = {
  userId?: ObjectId | { toString(): string } | string;
  serviceDate: string;
  mealType: string;
  numberOfMeals?: number;
};

type Expense = {
  serviceDate?: string;
  category?: string;
  amount: number;
};

type Deposit = {
  userId: ObjectId | { toString(): string } | string;
  amount: number;
};

type BalanceRecord = {
  userId: string;
  balance?: number;
  lastUpdated?: Date | null;
};

type UserRecord = {
  _id: ObjectId;
  name?: string;
  email?: string;
  role?: string;
  room?: string;
  fixedDeposit?: number;
  mosqueFee?: number;
};

type FinalizationMemberDetail = {
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
  month: string;
  finalizedAt?: Date;
  finalizedDate?: string;
  mealRate: number;
  totalMealsServed: number;
  totalDeposits?: number;
  totalMembers?: number;
  totalExpenses: number;
  memberDetails?: FinalizationMemberDetail[];
};

type RunningMealRateSummary = {
  month: string;
  asOf: string;
  totalMealsServed: number;
  totalExpenses: number;
  mealRate: number;
};

type DashboardSummary = {
  month: string;
  finalized: boolean;
  user: {
    userId: string;
    name?: string;
    email?: string;
    role?: string;
    mosqueFee: number;
    fixedDeposit: number;
  };
  monthData: {
    weightedMeals: number;
    mealsConsumed: number;
    totalDeposit: number;
  };
  balance: {
    current: number;
    projected: number;
  };
  projection: {
    averageMealRate: number;
    sourceMonths: string[];
    projectedMealCost: number;
    projectedMosqueFee: number;
  };
  finalization: null | {
    finalizedAt?: Date;
    finalizedDate?: string;
    mealRate: number;
    totalMealsServed: number;
    totalExpenses: number;
    user: FinalizationMemberDetail;
  };
};

type MealTrendRecord = {
  serviceDate: string;
  totalMeals: number;
  morning: number;
  evening: number;
  night: number;
};

type ExpenseTrendRecord = {
  serviceDate: string;
  totalAmount: number;
  categories: Record<string, number>;
};

type MonthSummary = {
  month: string;
  finalized: boolean;
  totalMealsServed: number;
  totalExpenses: number;
  totalDeposits: number;
  mealRate: number;
  totalMembers: number;
};

type TopMemberRecord = {
  rank: number;
  userId: string;
  userName?: string;
  email?: string;
  room?: string;
  totalMeals: number;
  breakdown: {
    morning: number;
    evening: number;
    night: number;
  };
};

type TwoDaySheetSummaryRecord = {
  serviceDate: string;
  scheduleExists: boolean;
  isHoliday: boolean;
  availableMeals: string[];
  totalRegisteredUsers: number;
  totalRegistrations: number;
  mealTypes: Record<string, { registeredUsers: number; totalMeals: number }>;
};

type AllTimeLeader = {
  userId: string;
  userName?: string;
  email?: string;
  room?: string;
  total: number;
};

type AllTimeSummary = {
  totalMealsServed: number;
  totalRegistrations: number;
  totalRegisteredUsers: number;
  totalUsers: number;
  activeUsers: number;
  totalDeposits: number;
  totalExpenses: number;
  averageDepositPerUser: number;
  finalizedMonths: number;
  schedulesCount: number;
  topDepositors: AllTimeLeader[];
  topConsumers: AllTimeLeader[];
  mealTypeBreakdown: {
    morning: number;
    evening: number;
    night: number;
  };
};

const MEAL_TYPES = ['morning', 'evening', 'night'] as const;

const getWeightedMealCount = (registrations: MealRegistration[], schedules: MealSchedule[]) => {
  const scheduleMap: Record<string, MealSchedule> = {};
  for (const schedule of schedules) {
    scheduleMap[schedule.serviceDate] = schedule;
  }

  let totalMealsServed = 0;
  for (const registration of registrations) {
    const schedule = scheduleMap[registration.serviceDate];
    if (!schedule) {
      continue;
    }

    const meal = schedule.availableMeals?.find((item) => item.mealType === registration.mealType);
    const weight = meal?.weight || 1;
    const numberOfMeals = registration.numberOfMeals || 1;
    totalMealsServed += numberOfMeals * weight;
  }

  return totalMealsServed;
};

const getWeightedMealValue = (registration: MealRegistration, schedule: MealSchedule | undefined) => {
  if (!schedule) {
    return 0;
  }

  const meal = schedule.availableMeals?.find((item) => item.mealType === registration.mealType);
  const weight = meal?.weight || 1;
  const numberOfMeals = registration.numberOfMeals || 1;
  return numberOfMeals * weight;
};

const createMealTypeTotals = () => ({
  morning: 0,
  evening: 0,
  night: 0
});

const getMonthServiceDates = (month: string) => {
  const start = DateTime.fromISO(`${month}-01`, { zone: BUSINESS_TIMEZONE }).startOf('month');
  const end = start.endOf('month');
  const dates: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    dates.push(cursor.toFormat('yyyy-LL-dd'));
    cursor = cursor.plus({ days: 1 });
  }

  return dates;
};

const getNextServiceDate = (serviceDate: string) => (
  DateTime.fromISO(serviceDate, { zone: BUSINESS_TIMEZONE }).plus({ days: 1 }).toFormat('yyyy-LL-dd')
);

const getMonthCollections = async (month: string) => {
  const { startServiceDate, endServiceDate } = getMonthServiceDateRange(month);
  const { users, mealRegistrations, mealSchedules, expenses, deposits, monthlyFinalization } = await getCollections();
  const [usersList, registrations, schedules, monthExpenses, monthDeposits, finalizedMonth] = await Promise.all([
    users.find({ isActive: { $ne: false } }).toArray() as Promise<UserRecord[]>,
    mealRegistrations.find(buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate)).toArray() as Promise<MealRegistration[]>,
    mealSchedules.find(buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate)).toArray() as Promise<MealSchedule[]>,
    expenses.find(buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate)).toArray() as Promise<Expense[]>,
    deposits.find({ month }).toArray() as Promise<Deposit[]>,
    monthlyFinalization.findOne({ month }) as Promise<FinalizationRecord | null>
  ]);

  return {
    usersList,
    registrations,
    schedules,
    monthExpenses,
    monthDeposits,
    finalizedMonth
  };
};

const buildScheduleMap = (schedules: MealSchedule[]) => {
  const scheduleMap: Record<string, MealSchedule> = {};
  for (const schedule of schedules) {
    scheduleMap[schedule.serviceDate] = schedule;
  }
  return scheduleMap;
};

const getAverageMealRateFromRecentFinalizations = async (monthlyFinalization: any, month: string) => {
  const recentFinalizations = await monthlyFinalization.find(
    { month: { $lt: month } },
    { projection: { month: 1, mealRate: 1 } }
  ).sort({ month: -1 }).limit(3).toArray() as FinalizationRecord[];

  if (recentFinalizations.length === 0) {
    return {
      averageMealRate: 0,
      sourceMonths: [] as string[]
    };
  }

  const totalMealRate = recentFinalizations.reduce((sum, item) => sum + (item.mealRate || 0), 0);
  return {
    averageMealRate: Number((totalMealRate / recentFinalizations.length).toFixed(2)),
    sourceMonths: recentFinalizations.map((item) => item.month)
  };
};

const getAllTimeSummary = async (_query: AllTimeSummaryQuery): Promise<AllTimeSummary> => {
  const { users, mealRegistrations, mealSchedules, expenses, deposits, monthlyFinalization } = await getCollections();
  const [usersList, registrations, schedules, allExpenses, allDeposits, finalizations] = await Promise.all([
    users.find({}).toArray() as Promise<UserRecord[]>,
    mealRegistrations.find({}).toArray() as Promise<MealRegistration[]>,
    mealSchedules.find({}).toArray() as Promise<MealSchedule[]>,
    expenses.find({}).toArray() as Promise<Expense[]>,
    deposits.find({}).toArray() as Promise<Deposit[]>,
    monthlyFinalization.find({}).toArray() as Promise<FinalizationRecord[]>
  ]);

  const scheduleMap = buildScheduleMap(schedules);
  const usersMap = new Map(usersList.map((user) => [user._id.toString(), user] as const));
  const registeredUsers = new Set<string>();
  const depositorTotals = new Map<string, number>();
  const consumerTotals = new Map<string, number>();
  const mealTypeBreakdown = createMealTypeTotals();

  for (const registration of registrations) {
    const userId = registration.userId?.toString();
    if (!userId) {
      continue;
    }

    registeredUsers.add(userId);
    const value = getWeightedMealValue(registration, scheduleMap[registration.serviceDate]);
    consumerTotals.set(userId, Number(((consumerTotals.get(userId) || 0) + value).toFixed(2)));
    mealTypeBreakdown[registration.mealType] = Number(((mealTypeBreakdown[registration.mealType] || 0) + value).toFixed(2));
  }

  for (const deposit of allDeposits) {
    const userId = deposit.userId?.toString();
    if (!userId) {
      continue;
    }

    depositorTotals.set(userId, Number(((depositorTotals.get(userId) || 0) + deposit.amount).toFixed(2)));
  }

  const buildLeaders = (totals: Map<string, number>): AllTimeLeader[] => (
    [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([userId, total]) => {
        const user = usersMap.get(userId);
        return {
          userId,
          userName: user?.name,
          email: user?.email,
          room: user?.room,
          total: Number((total || 0).toFixed(2))
        };
      })
  );

  const totalMealsServed = Number(getWeightedMealCount(registrations, schedules).toFixed(2));
  const totalDeposits = Number(allDeposits.reduce((sum, deposit) => sum + deposit.amount, 0).toFixed(2));
  const totalExpenses = Number(allExpenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2));
  const activeUsers = usersList.filter((user: any) => user.isActive !== false).length;
  const depositUserCount = depositorTotals.size;

  return {
    totalMealsServed,
    totalRegistrations: registrations.length,
    totalRegisteredUsers: registeredUsers.size,
    totalUsers: usersList.length,
    activeUsers,
    totalDeposits,
    totalExpenses,
    averageDepositPerUser: depositUserCount > 0 ? Number((totalDeposits / depositUserCount).toFixed(2)) : 0,
    finalizedMonths: finalizations.length,
    schedulesCount: schedules.length,
    topDepositors: buildLeaders(depositorTotals),
    topConsumers: buildLeaders(consumerTotals),
    mealTypeBreakdown
  };
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

  const totalMealsServed = getWeightedMealCount(allRegistrations as MealRegistration[], allSchedules as MealSchedule[]);

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

const getMonthSummary = async ({ month }: MonthSummaryQuery): Promise<MonthSummary> => {
  const { usersList, registrations, schedules, monthExpenses, monthDeposits, finalizedMonth } = await getMonthCollections(month);

  if (finalizedMonth) {
    return {
      month,
      finalized: true,
      totalMealsServed: finalizedMonth.totalMealsServed || 0,
      totalExpenses: finalizedMonth.totalExpenses || 0,
      totalDeposits: Number((finalizedMonth.totalDeposits || 0).toFixed(2)),
      mealRate: Number((finalizedMonth.mealRate || 0).toFixed(2)),
      totalMembers: finalizedMonth.totalMembers || usersList.length
    };
  }

  const totalMealsServed = Number(getWeightedMealCount(registrations, schedules).toFixed(2));
  const totalExpenses = Number(monthExpenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2));
  const totalDeposits = Number(monthDeposits.reduce((sum, deposit) => sum + deposit.amount, 0).toFixed(2));
  const mealRate = totalMealsServed > 0 ? Number((totalExpenses / totalMealsServed).toFixed(2)) : 0;

  return {
    month,
    finalized: false,
    totalMealsServed,
    totalExpenses,
    totalDeposits,
    mealRate,
    totalMembers: usersList.length
  };
};

const getMealTrendSummary = async ({ month }: MealTrendQuery) => {
  const { registrations, schedules } = await getMonthCollections(month);
  const scheduleMap = buildScheduleMap(schedules);
  const dailyTotals = new Map<string, MealTrendRecord>();

  for (const schedule of schedules) {
    dailyTotals.set(schedule.serviceDate, {
      serviceDate: schedule.serviceDate,
      totalMeals: 0,
      morning: 0,
      evening: 0,
      night: 0
    });
  }

  for (const registration of registrations) {
    const record = dailyTotals.get(registration.serviceDate);
    if (!record) {
      continue;
    }

    const value = getWeightedMealValue(registration, scheduleMap[registration.serviceDate]);
    record.totalMeals = Number((record.totalMeals + value).toFixed(2));
    record[registration.mealType] = Number(((record[registration.mealType] || 0) + value).toFixed(2));
  }

  const records = [...dailyTotals.values()].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
  return { month, count: records.length, records };
};

const getExpenseTrendSummary = async ({ month }: ExpenseTrendQuery) => {
  const { monthExpenses } = await getMonthCollections(month);
  const expenseByDate = new Map<string, ExpenseTrendRecord>();

  for (const serviceDate of getMonthServiceDates(month)) {
    expenseByDate.set(serviceDate, {
      serviceDate,
      totalAmount: 0,
      categories: {}
    });
  }

  for (const expense of monthExpenses) {
    const serviceDate = expense.serviceDate;
    if (!serviceDate) {
      continue;
    }

    const record = expenseByDate.get(serviceDate);
    if (!record) {
      continue;
    }

    record.totalAmount = Number((record.totalAmount + expense.amount).toFixed(2));
    if (expense.category) {
      record.categories[expense.category] = Number((((record.categories[expense.category] || 0) + expense.amount)).toFixed(2));
    }
  }

  const records = [...expenseByDate.values()].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
  return { month, count: records.length, records };
};

const getTopMembersSummary = async ({ month, limit = 10 }: TopMembersQuery) => {
  const { usersList, registrations, schedules } = await getMonthCollections(month);
  const usersMap = new Map(usersList.map((user) => [user._id.toString(), user] as const));
  const scheduleMap = buildScheduleMap(schedules);
  const totalsByUser = new Map<string, TopMemberRecord>();

  for (const registration of registrations) {
    const userId = registration.userId?.toString();
    if (!userId) {
      continue;
    }

    const user = usersMap.get(userId);
    if (!user) {
      continue;
    }

    const existing = totalsByUser.get(userId) || {
      rank: 0,
      userId,
      userName: user.name,
      email: user.email,
      room: user.room,
      totalMeals: 0,
      breakdown: createMealTypeTotals()
    };

    const value = getWeightedMealValue(registration, scheduleMap[registration.serviceDate]);
    existing.totalMeals = Number((existing.totalMeals + value).toFixed(2));
    existing.breakdown[registration.mealType] = Number(((existing.breakdown[registration.mealType] || 0) + value).toFixed(2));
    totalsByUser.set(userId, existing);
  }

  const members = [...totalsByUser.values()]
    .sort((a, b) => b.totalMeals - a.totalMeals || (a.userName || '').localeCompare(b.userName || ''))
    .slice(0, limit)
    .map((member, index) => ({ ...member, rank: index + 1 }));

  return { month, count: members.length, limit, members };
};

const getMealTypeBreakdownSummary = async ({ month }: MealTypeBreakdownQuery) => {
  const { registrations, schedules } = await getMonthCollections(month);
  const scheduleMap = buildScheduleMap(schedules);
  const totals = createMealTypeTotals();

  for (const registration of registrations) {
    const value = getWeightedMealValue(registration, scheduleMap[registration.serviceDate]);
    totals[registration.mealType] = Number(((totals[registration.mealType] || 0) + value).toFixed(2));
  }

  const totalMeals = Number((totals.morning + totals.evening + totals.night).toFixed(2));
  const breakdown = Object.fromEntries(
    MEAL_TYPES.map((mealType) => {
      const total = totals[mealType];
      const percentage = totalMeals > 0 ? Number(((total / totalMeals) * 100).toFixed(2)) : 0;
      return [mealType, { total, percentage }];
    })
  );

  return {
    month,
    totalMeals,
    breakdown
  };
};

const getTwoDaySheetSummary = async ({ date }: TwoDaySheetSummaryQuery) => {
  const firstDate = formatServiceDate(date);
  const secondDate = getNextServiceDate(firstDate);
  const targetDates = [firstDate, secondDate];
  const { mealRegistrations, mealSchedules } = await getCollections();
  const [registrations, schedules] = await Promise.all([
    mealRegistrations.find({ serviceDate: { $in: targetDates } }).toArray() as Promise<MealRegistration[]>,
    mealSchedules.find({ serviceDate: { $in: targetDates } }).toArray() as Promise<MealSchedule[]>
  ]);

  const scheduleMap = buildScheduleMap(schedules);
  const registrationsByDate = new Map<string, MealRegistration[]>();
  for (const registration of registrations) {
    const items = registrationsByDate.get(registration.serviceDate) || [];
    items.push(registration);
    registrationsByDate.set(registration.serviceDate, items);
  }

  const records: TwoDaySheetSummaryRecord[] = targetDates.map((serviceDate) => {
    const schedule = scheduleMap[serviceDate];
    const dailyRegistrations = registrationsByDate.get(serviceDate) || [];
    const uniqueUsers = new Set(dailyRegistrations.map((registration) => registration.userId?.toString()).filter(Boolean));
    const mealTypes: Record<string, { registeredUsers: number; totalMeals: number }> = {};

    for (const mealType of MEAL_TYPES) {
      const matchingRegistrations = dailyRegistrations.filter((registration) => registration.mealType === mealType);
      mealTypes[mealType] = {
        registeredUsers: new Set(matchingRegistrations.map((registration) => registration.userId?.toString()).filter(Boolean)).size,
        totalMeals: Number(matchingRegistrations.reduce((sum, registration) => (
          sum + (registration.numberOfMeals || 1)
        ), 0).toFixed(2))
      };
    }

    return {
      serviceDate,
      scheduleExists: Boolean(schedule),
      isHoliday: Boolean(schedule?.isHoliday),
      availableMeals: (schedule?.availableMeals || []).filter((meal) => meal.isAvailable !== false).map((meal) => meal.mealType),
      totalRegisteredUsers: uniqueUsers.size,
      totalRegistrations: dailyRegistrations.length,
      mealTypes
    };
  });

  return {
    date: firstDate,
    nextDate: secondDate,
    count: records.length,
    records
  };
};

const getDashboardSummary = async (
  currentUserId: ObjectId | undefined,
  { month }: DashboardQuery
): Promise<DashboardSummary> => {
  if (!currentUserId) {
    throw createHttpError(401, 'Authenticated application user is required');
  }

  const userId = currentUserId.toString();
  const { startServiceDate, endServiceDate } = getMonthServiceDateRange(month);
  const todayServiceDate = getCurrentServiceDate();
  const monthToDateEnd = todayServiceDate < endServiceDate ? todayServiceDate : endServiceDate;
  const {
    users,
    mealRegistrations,
    mealSchedules,
    deposits,
    memberBalances,
    monthlyFinalization
  } = await getCollections();

  const [user, balanceRecord, finalizedMonth, averageMealRateSummary] = await Promise.all([
    users.findOne({ _id: currentUserId }) as Promise<UserRecord | null>,
    memberBalances.findOne({ userId }) as Promise<BalanceRecord | null>,
    monthlyFinalization.findOne({ month }) as Promise<FinalizationRecord | null>,
    getAverageMealRateFromRecentFinalizations(monthlyFinalization, month)
  ]);

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  const currentBalance = Number((balanceRecord?.balance || 0).toFixed(2));
  const fixedDeposit = user.fixedDeposit || 0;
  const mosqueFee = user.mosqueFee || 0;

  if (finalizedMonth) {
    const userFinalization = finalizedMonth.memberDetails?.find((member) => member.userId === userId);
    if (!userFinalization) {
      throw createHttpError(404, 'No finalized dashboard data found for this user');
    }

    return {
      month,
      finalized: true,
      user: {
        userId,
        name: user.name,
        email: user.email,
        role: user.role,
        mosqueFee,
        fixedDeposit
      },
      monthData: {
        weightedMeals: userFinalization.totalMeals || 0,
        mealsConsumed: userFinalization.totalMeals || 0,
        totalDeposit: userFinalization.totalDeposits || 0
      },
      balance: {
        current: Number((userFinalization.newBalance || 0).toFixed(2)),
        projected: Number((userFinalization.newBalance || 0).toFixed(2))
      },
      projection: {
        averageMealRate: Number((finalizedMonth.mealRate || 0).toFixed(2)),
        sourceMonths: [month],
        projectedMealCost: Number((userFinalization.mealCost || 0).toFixed(2)),
        projectedMosqueFee: Number((userFinalization.mosqueFee || 0).toFixed(2))
      },
      finalization: {
        finalizedAt: finalizedMonth.finalizedAt,
        finalizedDate: finalizedMonth.finalizedDate || formatServiceDate(finalizedMonth.finalizedAt),
        mealRate: Number((finalizedMonth.mealRate || 0).toFixed(2)),
        totalMealsServed: finalizedMonth.totalMealsServed || 0,
        totalExpenses: finalizedMonth.totalExpenses || 0,
        user: userFinalization
      }
    };
  }

  const [userRegistrations, consumedRegistrations, monthSchedules, consumedSchedules, monthDeposits] = await Promise.all([
    mealRegistrations.find({ userId: currentUserId, ...buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate) }).toArray() as Promise<MealRegistration[]>,
    mealRegistrations.find({ userId: currentUserId, ...buildCanonicalServiceDateRangeQuery(startServiceDate, monthToDateEnd) }).toArray() as Promise<MealRegistration[]>,
    mealSchedules.find(buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate)).toArray() as Promise<MealSchedule[]>,
    mealSchedules.find(buildCanonicalServiceDateRangeQuery(startServiceDate, monthToDateEnd)).toArray() as Promise<MealSchedule[]>,
    deposits.find({ userId, month }).toArray() as Promise<Deposit[]>
  ]);

  const weightedMeals = Number(getWeightedMealCount(userRegistrations, monthSchedules).toFixed(2));
  const mealsConsumed = Number(getWeightedMealCount(consumedRegistrations, consumedSchedules).toFixed(2));
  const totalDeposit = Number(monthDeposits.reduce((sum, deposit) => sum + deposit.amount, 0).toFixed(2));
  const projectedMealCost = Number((weightedMeals * averageMealRateSummary.averageMealRate).toFixed(2));
  const projectedMosqueFee = Number(mosqueFee.toFixed(2));
  const projectedBalance = Number((currentBalance - projectedMealCost - projectedMosqueFee).toFixed(2));

  return {
    month,
    finalized: false,
    user: {
      userId,
      name: user.name,
      email: user.email,
      role: user.role,
      mosqueFee,
      fixedDeposit
    },
    monthData: {
      weightedMeals,
      mealsConsumed,
      totalDeposit
    },
    balance: {
      current: currentBalance,
      projected: projectedBalance
    },
    projection: {
      averageMealRate: averageMealRateSummary.averageMealRate,
      sourceMonths: averageMealRateSummary.sourceMonths,
      projectedMealCost,
      projectedMosqueFee
    },
    finalization: null
  };
};

export {
  getAllTimeSummary,
  getDashboardSummary,
  getMonthSummary,
  getMealTrendSummary,
  getExpenseTrendSummary,
  getTopMembersSummary,
  getMealTypeBreakdownSummary,
  getTwoDaySheetSummary,
  getRunningMealRateSummary
};
