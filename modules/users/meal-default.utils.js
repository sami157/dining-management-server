const { DateTime } = require('luxon');
const { getMonthFromDate } = require('../finance/accounting.utils');
const { buildMealActivityLog, insertActivityLogs, systemActor } = require('./activityLogs.utils');

const TIME_ZONE = 'Asia/Dhaka';

const DEFAULT_DEADLINES = {
  morning: { hours: 22, dayOffset: -1 },
  evening: { hours: 8, dayOffset: 0 },
  night: { hours: 14, dayOffset: 0 }
};

const getDhakaTodayStartDate = (now = new Date()) => {
  const dateKey = DateTime.fromJSDate(now).setZone(TIME_ZONE).toFormat('yyyy-MM-dd');
  // Schedule dates are stored at UTC midnight for their Dhaka calendar date.
  return new Date(`${dateKey}T00:00:00.000Z`);
};

const calculateMealDeadline = (mealDate, mealType, customDeadline) => {
  if (customDeadline) {
    return new Date(customDeadline);
  }

  const config = DEFAULT_DEADLINES[mealType];
  if (!config) return null;

  return DateTime.fromJSDate(new Date(mealDate))
    .setZone(TIME_ZONE)
    .plus({ days: config.dayOffset })
    .set({ hour: config.hours, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
};

const getMealDefaultRegistrationCandidates = ({
  schedules,
  existingRegistrations,
  finalizedMonths,
  userId,
  currentTime
}) => {
  const existingKeys = new Set(
    existingRegistrations.map(registration => `${registration.date.toISOString()}_${registration.mealType}`)
  );
  const finalizedMonthSet = finalizedMonths instanceof Set ? finalizedMonths : new Set(finalizedMonths);
  const candidates = [];

  for (const schedule of schedules) {
    const scheduleMonth = getMonthFromDate(schedule.date);
    if (!scheduleMonth || finalizedMonthSet.has(scheduleMonth)) continue;

    for (const meal of schedule.availableMeals || []) {
      if (meal.isAvailable !== true) continue;

      const key = `${schedule.date.toISOString()}_${meal.mealType}`;
      if (existingKeys.has(key)) continue;

      const deadline = calculateMealDeadline(schedule.date, meal.mealType, meal.customDeadline);
      if (!deadline || Number.isNaN(deadline.getTime()) || currentTime > deadline) continue;

      candidates.push({
        userId,
        date: schedule.date,
        mealType: meal.mealType,
        numberOfMeals: 1,
        registeredAt: currentTime
      });
    }
  }

  return candidates;
};

const readCollection = async cursor => {
  if (typeof cursor.sort === 'function') cursor = cursor.sort({ date: 1 });
  return cursor.toArray();
};

const isDuplicateKeyError = error => {
  if (error?.code === 11000) return true;
  const writeErrors = error?.writeErrors || error?.result?.getWriteErrors?.() || [];
  return writeErrors.length > 0 && writeErrors.every(writeError => writeError.code === 11000);
};

const createMealDefaultRegistrations = async ({
  userId,
  mealSchedules,
  mealRegistrations,
  monthlyFinalization,
  systemLogs,
  targetUser,
  session,
  trigger = 'default_preference',
  now = new Date()
}) => {
  const todayStart = getDhakaTodayStartDate(now);
  const readOptions = session ? { session } : undefined;
  const schedules = await readCollection(
    mealSchedules.find({ date: { $gte: todayStart } }, readOptions)
  );

  if (schedules.length === 0) return 0;

  const months = [...new Set(schedules.map(schedule => getMonthFromDate(schedule.date)).filter(Boolean))];
  const [finalizedRecords, existingRegistrations] = await Promise.all([
    monthlyFinalization.find(
      { month: { $in: months } },
      { projection: { month: 1 }, ...readOptions }
    ).toArray(),
    mealRegistrations.find({ userId, date: { $gte: todayStart } }, readOptions).toArray()
  ]);

  const candidates = getMealDefaultRegistrationCandidates({
    schedules,
    existingRegistrations,
    finalizedMonths: new Set(finalizedRecords.map(record => record.month)),
    userId,
    currentTime: now
  });

  if (candidates.length === 0) return 0;

  // Upserts use the existing unique (userId, date, mealType) index as a final
  // guard against duplicate registrations from concurrent schedule updates.
  const operations = candidates.map(registration => ({
    updateOne: {
      filter: {
        userId: registration.userId,
        date: registration.date,
        mealType: registration.mealType
      },
      update: { $setOnInsert: registration },
      upsert: true
    }
  }));

  let registeredCount = 0;
  const batchSize = 500;

  const logsForResult = (result, candidatesInBatch) => {
    if (!systemLogs || !targetUser || !result?.upsertedIds) return [];

    return Object.entries(result.upsertedIds).map(([index, insertedId]) => buildMealActivityLog({
      action: 'meal_registered',
      registration: { ...candidatesInBatch[Number(index)], _id: insertedId },
      targetUser,
      actorUser: systemActor('Automatic registration'),
      trigger,
      automatic: true,
      createdAt: now
    }));
  };

  for (let index = 0; index < operations.length; index += batchSize) {
    const batch = operations.slice(index, index + batchSize);
    const batchCandidates = candidates.slice(index, index + batchSize);
    try {
      const result = await mealRegistrations.bulkWrite(batch, {
        ordered: false,
        ...(session ? { session } : {})
      });
      registeredCount += result.upsertedCount;
      await insertActivityLogs(systemLogs, logsForResult(result, batchCandidates), { session });
    } catch (error) {
      // Another registration path may insert the same meal after our read.
      // Retry the idempotent upserts once; unrelated write errors still fail.
      if (!isDuplicateKeyError(error)) throw error;
      registeredCount += error.upsertedCount || 0;
      const firstResult = error.result || error;
      await insertActivityLogs(systemLogs, logsForResult(firstResult, batchCandidates), { session });
      const result = await mealRegistrations.bulkWrite(batch, {
        ordered: false,
        ...(session ? { session } : {})
      });
      registeredCount += result.upsertedCount;
      await insertActivityLogs(systemLogs, logsForResult(result, batchCandidates), { session });
    }
  }

  return registeredCount;
};

const applyMealDefaultPreference = async ({
  user,
  mealDefault,
  users,
  mealSchedules,
  mealRegistrations,
  monthlyFinalization,
  systemLogs,
  session,
  now = new Date()
}) => {
  const wasEnabled = user.mealDefault === true;
  const result = await users.findOneAndUpdate(
    { _id: user._id },
    { $set: { mealDefault, updatedAt: now } },
    { returnDocument: 'after', ...(session ? { session } : {}) }
  );

  if (!result) return null;

  if (!mealDefault || wasEnabled) {
    return { user: result, registeredCount: 0 };
  }

  try {
    const registeredCount = await createMealDefaultRegistrations({
      userId: user._id,
      mealSchedules,
      mealRegistrations,
      monthlyFinalization,
      systemLogs,
      targetUser: result,
      session,
      trigger: 'default_preference',
      now
    });
    return { user: result, registeredCount };
  } catch (error) {
    // Leave the preference off if the catch-up failed so the user can retry.
    await users.updateOne(
      { _id: user._id, mealDefault: true },
      { $set: { mealDefault: false, updatedAt: new Date() } },
      session ? { session } : undefined
    );
    throw error;
  }
};

module.exports = {
  getDhakaTodayStartDate,
  calculateMealDeadline,
  getMealDefaultRegistrationCandidates,
  createMealDefaultRegistrations,
  applyMealDefaultPreference
};
