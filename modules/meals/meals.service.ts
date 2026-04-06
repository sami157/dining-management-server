// @ts-nocheck
const { ObjectId } = require('mongodb');
const { getCollections } = require('../../config/connectMongodb');
const {
  calculateMealDeadline,
  getMealDeadlineConfig
} = require('../meal-deadlines/meal-deadlines.service');

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getAvailableMealsForUser = async (userId, query) => {
  const { startDate, endDate, month } = query;
  const currentTime = new Date();
  let start;
  let end;

  if (month) {
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthRegex.test(month)) {
      throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
    }

    const [year, monthNum] = month.split('-').map(Number);
    start = new Date(year, monthNum - 1, 1);
    end = new Date(year, monthNum, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    if (!startDate || !endDate) {
      throw createHttpError(400, 'Either month OR both startDate and endDate are required');
    }

    start = new Date(startDate);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }

  const { mealSchedules, mealRegistrations } = await getCollections();
  const [schedules, userRegistrations, mealDeadlineConfig] = await Promise.all([
    mealSchedules.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 }).toArray(),
    mealRegistrations.find({ userId, date: { $gte: start, $lte: end } }).toArray(),
    getMealDeadlineConfig()
  ]);

  const registrationMap = {};
  userRegistrations.forEach(reg => {
    const key = `${reg.date.toISOString().split('T')[0]}_${reg.mealType}`;
    registrationMap[key] = reg;
  });

  const schedulesWithMeals = schedules.map(schedule => {
    const meals = schedule.availableMeals.map(meal => {
      const deadline = calculateMealDeadline(schedule.date, meal.mealType, meal.customDeadline, mealDeadlineConfig);
      const registrationKey = `${schedule.date.toISOString().split('T')[0]}_${meal.mealType}`;
      const existingRegistration = registrationMap[registrationKey];
      const isRegistered = Boolean(existingRegistration);

      return {
        mealType: meal.mealType,
        isAvailable: meal.isAvailable,
        menu: meal.menu || '',
        weight: meal.weight || 1,
        deadline,
        canRegister: meal.isAvailable && currentTime <= deadline && !isRegistered,
        isRegistered,
        registrationId: isRegistered ? existingRegistration._id : null,
        numberOfMeals: isRegistered ? existingRegistration.numberOfMeals || 1 : null
      };
    });

    return { date: schedule.date, isHoliday: schedule.isHoliday, meals };
  });

  return { count: schedulesWithMeals.length, schedules: schedulesWithMeals };
};

const createMealRegistration = async (payload, currentUser) => {
  const { date, mealType, userId: requestUserId, numberOfMeals } = payload;
  let userId = currentUser?._id;
  let isLateRegistration = false;
  const currentTime = new Date();

  if (requestUserId) {
    if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin') {
      throw createHttpError(403, 'Not authorized to register for others');
    }
    userId = new ObjectId(requestUserId);
  }

  if (!date || !mealType) {
    throw createHttpError(400, 'date and mealType are required');
  }

  if (!['morning', 'evening', 'night'].includes(mealType)) {
    throw createHttpError(400, 'mealType must be morning, evening, or night');
  }

  const mealDate = new Date(date);
  const { mealSchedules, mealRegistrations, users, systemLogs } = await getCollections();
  const mealDeadlineConfig = await getMealDeadlineConfig();

  const schedule = await mealSchedules.findOne({ date: mealDate });
  if (!schedule) {
    throw createHttpError(404, 'No meal schedule found for this date');
  }

  const meal = schedule.availableMeals.find(item => item.mealType === mealType);
  if (!meal || !meal.isAvailable) {
    throw createHttpError(400, 'This meal is not available on this date');
  }

  if (!requestUserId) {
    const deadline = calculateMealDeadline(mealDate, mealType, meal.customDeadline, mealDeadlineConfig);
    if (currentTime > deadline) {
      throw createHttpError(400, 'Registration deadline has passed for this meal');
    }
  }

  const existingRegistration = await mealRegistrations.findOne({ userId, date: mealDate, mealType });
  if (existingRegistration) {
    throw createHttpError(400, 'You have already registered for this meal');
  }

  const registration = {
    userId,
    date: mealDate,
    mealType,
    numberOfMeals: numberOfMeals || 1,
    registeredAt: new Date()
  };

  const result = await mealRegistrations.insertOne(registration);

  if (requestUserId) {
    const deadline = calculateMealDeadline(mealDate, mealType, meal.customDeadline, mealDeadlineConfig);
    if (currentTime > deadline) {
      isLateRegistration = true;
    }
  }

  if (isLateRegistration) {
    const [byPerson, forPerson] = await Promise.all([
      users.findOne({ _id: new ObjectId(currentUser?._id) }, { projection: { name: 1 } }),
      users.findOne({ _id: userId }, { projection: { name: 1 } })
    ]);

    await systemLogs.insertOne({
      type: 'meal-on',
      byPerson,
      forPerson,
      registration
    });
  }

  return {
    message: 'Meal registered successfully',
    registrationId: result.insertedId,
    registration: { ...registration, _id: result.insertedId }
  };
};

const editMealRegistration = async (registrationId, numberOfMeals, currentUser) => {
  if (!ObjectId.isValid(registrationId)) {
    throw createHttpError(400, 'Invalid registration ID');
  }

  if (!numberOfMeals || typeof numberOfMeals !== 'number' || numberOfMeals < 1) {
    throw createHttpError(400, 'numberOfMeals must be a positive number');
  }

  const { mealRegistrations, mealSchedules } = await getCollections();
  const mealDeadlineConfig = await getMealDeadlineConfig();
  const registration = await mealRegistrations.findOne({ _id: new ObjectId(registrationId) });

  if (!registration) {
    throw createHttpError(404, 'Registration not found');
  }

  if (!registration.userId.equals(currentUser?._id) && currentUser.role !== 'admin' && currentUser.role !== 'super_admin') {
    throw createHttpError(403, 'You can only update your own registration');
  }

  if (currentUser.role !== 'admin') {
    const schedule = await mealSchedules.findOne({ date: registration.date });
    if (!schedule) {
      throw createHttpError(404, 'Meal schedule not found for this date');
    }

    const mealConfig = schedule.availableMeals.find(item => item.mealType === registration.mealType);
    if (!mealConfig || !mealConfig.isAvailable) {
      throw createHttpError(400, 'Meal is no longer available for modification');
    }

    const deadline = calculateMealDeadline(
      new Date(registration.date),
      registration.mealType,
      mealConfig.customDeadline || null,
      mealDeadlineConfig
    );

    if (new Date() > deadline) {
      throw createHttpError(400, 'Deadline has passed. Changes are no longer allowed.');
    }
  }

  await mealRegistrations.updateOne(
    { _id: new ObjectId(registrationId) },
    { $set: { numberOfMeals, updatedAt: new Date() } }
  );
};

const removeMealRegistration = async (registrationId, currentUser) => {
  if (!ObjectId.isValid(registrationId)) {
    throw createHttpError(400, 'Invalid registration ID');
  }

  const { users, mealRegistrations, mealSchedules, systemLogs } = await getCollections();
  const mealDeadlineConfig = await getMealDeadlineConfig();
  const user = await users.findOne({ _id: currentUser?._id });
  const registration = await mealRegistrations.findOne({ _id: new ObjectId(registrationId) });

  if (!registration) {
    throw createHttpError(404, 'Registration not found');
  }

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    const schedule = await mealSchedules.findOne({ date: registration.date });
    if (!schedule) {
      throw createHttpError(404, 'Meal schedule not found');
    }

    const meal = schedule.availableMeals.find(item => item.mealType === registration.mealType);
    if (!meal) {
      throw createHttpError(400, 'Meal configuration not found');
    }

    const deadline = calculateMealDeadline(registration.date, registration.mealType, meal.customDeadline, mealDeadlineConfig);
    if (new Date() > deadline) {
      throw createHttpError(400, 'Cancellation deadline has passed for this meal');
    }

    if (!registration.userId.equals(currentUser?._id)) {
      throw createHttpError(403, 'You can only cancel your own registration');
    }
  }

  if (!registration.userId.equals(currentUser?._id)) {
    const [byPerson, forPerson] = await Promise.all([
      users.findOne({ _id: new ObjectId(currentUser?._id) }, { projection: { name: 1 } }),
      users.findOne({ _id: registration.userId }, { projection: { name: 1 } })
    ]);

    await systemLogs.insertOne({
      type: 'meal-off',
      byPerson,
      forPerson,
      mealDate: registration.mealDate,
      mealType: registration.mealType,
      cancelledAt: new Date()
    });
  }

  await mealRegistrations.deleteOne({ _id: new ObjectId(registrationId) });
};

const getMealTotalsForUser = async (email, month) => {
  const { users, mealRegistrations, mealSchedules } = await getCollections();
  const user = await users.findOne({ email });

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  if (month) {
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthRegex.test(month)) {
      throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
    }
  }

  let start;
  let end;

  if (month) {
    const [year, monthNum] = month.split('-').map(Number);
    start = new Date(year, monthNum - 1, 1);
    end = new Date(year, monthNum, 0);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  const [registrations, schedules] = await Promise.all([
    mealRegistrations.find({ userId: user._id, date: { $gte: start, $lte: end } }).toArray(),
    mealSchedules.find({ date: { $gte: start, $lte: end } }).toArray()
  ]);

  const scheduleMap = {};
  for (const schedule of schedules) {
    scheduleMap[schedule.date.toISOString()] = schedule;
  }

  let totalMeals = 0;
  const mealBreakdown = { morning: 0, evening: 0, night: 0 };

  for (const registration of registrations) {
    const schedule = scheduleMap[registration.date.toISOString()];
    if (!schedule) continue;

    const meal = schedule.availableMeals.find(item => item.mealType === registration.mealType);
    if (!meal) continue;

    const weight = meal.weight || 1;
    const count = registration.numberOfMeals || 1;
    totalMeals += count * weight;
    mealBreakdown[registration.mealType] += count * weight;
  }

  const currentMonth = month || `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

  return {
    userId: user._id,
    userName: user.name,
    email: user.email,
    month: currentMonth,
    totalMeals,
    mealCount: registrations.length,
    breakdown: mealBreakdown,
    registrations: registrations.length
  };
};

const bulkRegisterMealsForUser = async (month, userId) => {
  if (!month) {
    throw createHttpError(400, 'month is required (format: YYYY-MM)');
  }

  const [year, monthIndex] = month.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, monthIndex - 1, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));

  const currentTime = new Date();
  const { mealSchedules, mealRegistrations } = await getCollections();
  const [schedules, existingRegistrations, mealDeadlineConfig] = await Promise.all([
    mealSchedules.find({ date: { $gte: monthStart, $lte: monthEnd } }).toArray(),
    mealRegistrations.find({ userId, date: { $gte: monthStart, $lte: monthEnd } }).toArray(),
    getMealDeadlineConfig()
  ]);

  const registeredSet = new Set(
    existingRegistrations.map(reg => `${reg.date.toISOString()}_${reg.mealType}`)
  );

  const toInsert = [];
  for (const schedule of schedules) {
    for (const meal of schedule.availableMeals) {
      if (!meal.isAvailable) continue;

      const key = `${schedule.date.toISOString()}_${meal.mealType}`;
      if (registeredSet.has(key)) continue;

      const deadline = calculateMealDeadline(schedule.date, meal.mealType, meal.customDeadline, mealDeadlineConfig);
      if (currentTime > deadline) continue;

      toInsert.push({
        userId,
        date: schedule.date,
        mealType: meal.mealType,
        numberOfMeals: 1,
        registeredAt: new Date()
      });
    }
  }

  if (toInsert.length === 0) {
    return {
      message: 'No available meals to register for',
      registeredCount: 0,
      status: 200
    };
  }

  await mealRegistrations.insertMany(toInsert);
  return {
    message: `Successfully registered for ${toInsert.length} meals`,
    registeredCount: toInsert.length,
    status: 201
  };
};

module.exports = {
  getAvailableMealsForUser,
  createMealRegistration,
  editMealRegistration,
  removeMealRegistration,
  getMealTotalsForUser,
  bulkRegisterMealsForUser
};

