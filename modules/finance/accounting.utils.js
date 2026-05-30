const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const validateMonth = month => MONTH_REGEX.test(month);

const getUtcMonthRange = month => {
  const [year, monthNum] = month.split('-').map(Number);

  return {
    startDate: new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0)),
    endDate: new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999)),
  };
};

const getMonthFromDate = date => {
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return null;

  return `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, '0')}`;
};

const toDateKey = date => date.toISOString().split('T')[0];

const round2 = value => Number((Number(value) || 0).toFixed(2));

const toCents = value => Math.round((Number(value) || 0) * 100);

const fromCents = cents => round2(cents / 100);

const assertMonthIsOpen = async (monthlyFinalization, month, session) => {
  const finalized = await monthlyFinalization.findOne({ month }, { session });
  return !finalized;
};

const allocateMealCosts = (members, totalExpenses, totalMealsServed) => {
  const totalExpenseCents = toCents(totalExpenses);

  if (totalExpenseCents === 0 || totalMealsServed <= 0) {
    return {
      allocations: members.map(member => ({ userId: member.userId, mealCost: 0 })),
      roundingAdjustment: 0,
      totalMealCost: 0,
    };
  }

  const rawAllocations = members.map(member => {
    const exactCents = (Number(member.totalMeals) || 0) * totalExpenseCents / totalMealsServed;
    const floorCents = Math.floor(exactCents);

    return {
      userId: member.userId,
      floorCents,
      remainder: exactCents - floorCents,
    };
  });

  const floorTotal = rawAllocations.reduce((sum, item) => sum + item.floorCents, 0);
  let remainingCents = totalExpenseCents - floorTotal;

  rawAllocations.sort((a, b) => b.remainder - a.remainder);

  for (const item of rawAllocations) {
    if (remainingCents <= 0) break;
    item.floorCents += 1;
    remainingCents -= 1;
  }

  const allocationMap = new Map(rawAllocations.map(item => [item.userId, fromCents(item.floorCents)]));
  const allocations = members.map(member => ({
    userId: member.userId,
    mealCost: allocationMap.get(member.userId) || 0,
  }));
  const totalMealCost = allocations.reduce((sum, item) => sum + item.mealCost, 0);

  return {
    allocations,
    roundingAdjustment: round2(totalExpenses - totalMealCost),
    totalMealCost: round2(totalMealCost),
  };
};

const calculateWeightedMeals = async ({ collections, month, endDate, session }) => {
  const { users, mealRegistrations, mealSchedules } = collections;
  const { startDate, endDate: monthEndDate } = getUtcMonthRange(month);
  const rangeEnd = endDate || monthEndDate;

  const [activeUsers, allRegistrations, allSchedules] = await Promise.all([
    users.find({ isActive: { $ne: false } }, { session }).toArray(),
    mealRegistrations.find({ date: { $gte: startDate, $lte: rangeEnd } }, { session }).toArray(),
    mealSchedules.find({ date: { $gte: startDate, $lte: rangeEnd } }, { session }).toArray(),
  ]);

  const activeUserIds = new Set(activeUsers.map(user => user._id.toString()));
  const scheduleMap = new Map(allSchedules.map(schedule => [schedule.date.toISOString(), schedule]));
  const userMealsMap = new Map(activeUsers.map(user => [user._id.toString(), 0]));
  const dataQuality = {
    activeUsers: activeUsers.length,
    scheduleDocs: allSchedules.length,
    registrationDocs: allRegistrations.length,
    countedRegistrationDocs: 0,
    inactiveRegistrationDocs: 0,
    missingScheduleDocs: 0,
    missingMealConfigDocs: 0,
    duplicateRegistrationKeyCount: 0,
  };
  const duplicateKeys = new Map();

  for (const registration of allRegistrations) {
    const userId = registration.userId?.toString();
    const dateKey = registration.date?.toISOString();
    const duplicateKey = `${userId || 'missing'}_${dateKey || 'missing'}_${registration.mealType || 'missing'}`;
    duplicateKeys.set(duplicateKey, (duplicateKeys.get(duplicateKey) || 0) + 1);

    if (!userId || !activeUserIds.has(userId)) {
      dataQuality.inactiveRegistrationDocs += 1;
      continue;
    }

    const schedule = scheduleMap.get(registration.date.toISOString());
    if (!schedule) {
      dataQuality.missingScheduleDocs += 1;
      continue;
    }

    const meal = (schedule.availableMeals || []).find(item => item.mealType === registration.mealType);
    if (!meal) {
      dataQuality.missingMealConfigDocs += 1;
    }

    const weight = meal?.weight || 1;
    const numberOfMeals = registration.numberOfMeals || 1;
    const weightedMeals = numberOfMeals * weight;
    userMealsMap.set(userId, (userMealsMap.get(userId) || 0) + weightedMeals);
    dataQuality.countedRegistrationDocs += 1;
  }

  dataQuality.duplicateRegistrationKeyCount = Array.from(duplicateKeys.values()).filter(count => count > 1).length;

  return {
    month,
    startDate,
    endDate: rangeEnd,
    activeUsers,
    userMealsMap,
    totalMealsServed: Array.from(userMealsMap.values()).reduce((sum, value) => sum + value, 0),
    dataQuality,
  };
};

module.exports = {
  validateMonth,
  getUtcMonthRange,
  getMonthFromDate,
  toDateKey,
  round2,
  toCents,
  fromCents,
  assertMonthIsOpen,
  allocateMealCosts,
  calculateWeightedMeals,
};
