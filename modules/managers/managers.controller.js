const { ObjectId } = require('mongodb');
const { getCollections, getMongoClient } = require('../../config/connectMongodb');
const { assertMonthIsOpen, getMonthFromDate } = require('../finance/accounting.utils');
const { buildMealActivityLog, insertActivityLogs, systemActor } = require('../users/activityLogs.utils');

const getMonthsInRange = (start, end) => {
  const months = new Set();
  const currentDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const finalMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (currentDate <= finalMonth) {
    months.add(getMonthFromDate(currentDate));
    currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
  }

  return Array.from(months);
};

const ensureMonthsAreOpen = async (monthlyFinalization, months) => {
  const finalized = await monthlyFinalization.findOne({ month: { $in: months } });
  return !finalized;
};

// Helper function to check if a date is weekend (Fri or Sat)
const isWeekend = (date) => {
  const day = date.getDay(); // 0 to 6, 0 = Sun
  return day === 5 || day === 6;
};

// Helper function to get available meals based on day type
const getDefaultMeals = (date, isHoliday) => {
  const meals = [];

  if (isWeekend(date) || isHoliday) {
    meals.push(
      { mealType: 'morning', isAvailable: true, customDeadline: null, weight: 0.5, menu: '' },
      { mealType: 'evening', isAvailable: true, customDeadline: null, weight: 1, menu: '' },
      { mealType: 'night', isAvailable: true, customDeadline: null, weight: 1, menu: '' }
    );
  } else {
    meals.push(
      { mealType: 'morning', isAvailable: false, customDeadline: null, weight: 0.5, menu: '' },
      { mealType: 'evening', isAvailable: false, customDeadline: null, weight: 1, menu: '' },
      { mealType: 'night', isAvailable: true, customDeadline: null, weight: 1, menu: '' }
    );
  }

  return meals;
};

const generateSchedules = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const managerId = req.user._id;

    if (!managerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T00:00:00.000Z');

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (start > end) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    if (diffDays > 90) {
      return res.status(400).json({ error: 'Date range cannot exceed 90 days' });
    }

    const { mealSchedules, mealRegistrations, users, systemLogs, monthlyFinalization } = await getCollections();

    if (!await ensureMonthsAreOpen(monthlyFinalization, getMonthsInRange(start, end))) {
      return res.status(400).json({ error: 'Cannot generate schedules - one or more months are already finalized' });
    }

    // Fetch existing schedules and default users in parallel
    const [existingSchedules, defaultUsers] = await Promise.all([
      mealSchedules.find(
        { date: { $gte: start, $lte: end } },
        { projection: { date: 1 } }
      ).toArray(),
      users.find(
        { mealDefault: true, isActive: { $ne: false } },
        { projection: { _id: 1, name: 1, email: 1 } }
      ).toArray()
    ]);

    const existingDates = new Set(existingSchedules.map(s => s.date.getTime()));

    const schedulesToCreate = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateToCheck = new Date(currentDate);
      if (!existingDates.has(dateToCheck.getTime())) {
        schedulesToCreate.push({
          date: dateToCheck,
          isHoliday: false,
          availableMeals: getDefaultMeals(currentDate, false),
          createdBy: managerId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (schedulesToCreate.length === 0) {
      return res.status(200).json({
        message: 'All schedules already exist for this date range',
        count: 0
      });
    }

    const schedulesCreated = schedulesToCreate.length;
    let registrationsCreated = 0;
    const client = await getMongoClient();
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        await mealSchedules.insertMany(schedulesToCreate, { session });

        // Auto-register default users for each new schedule.
        if (defaultUsers.length > 0) {
          const registrations = [];
          const registeredAt = new Date();

          for (const schedule of schedulesToCreate) {
            const availableMealTypes = schedule.availableMeals
              .filter(meal => meal.isAvailable)
              .map(meal => meal.mealType);

            for (const user of defaultUsers) {
              for (const mealType of availableMealTypes) {
                registrations.push({
                  userId: user._id,
                  date: schedule.date,
                  mealType,
                  numberOfMeals: 1,
                  registeredAt
                });
              }
            }
          }

          if (registrations.length > 0) {
            const registrationResult = await mealRegistrations.insertMany(registrations, { session });
            registrationsCreated = registrationResult.insertedCount;
            const logs = registrations.map((registration, index) => buildMealActivityLog({
              action: 'meal_registered',
              registration: { ...registration, _id: registrationResult.insertedIds[index] },
              targetUser: defaultUsers.find(user => user._id.equals(registration.userId)),
              actorUser: systemActor('Automatic registration'),
              trigger: 'schedule_generation',
              automatic: true,
              createdAt: registeredAt
            }));
            await insertActivityLogs(systemLogs, logs, { session });
          }
        }
      });
    } finally {
      await session.endSession();
    }

    return res.status(201).json({
      message: `${schedulesCreated} schedules created successfully`,
      count: schedulesCreated,
      registrationsCreated
    });

  } catch (error) {
    console.error('Error generating schedules:', error);
    return res.status(500).json({ error: 'Failed to generate schedules' });
  }
};

const getSchedules = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    const { mealSchedules } = await getCollections();
    const schedules = await mealSchedules.find({
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 }).toArray();

    return res.status(200).json({ count: schedules.length, schedules });

  } catch (error) {
    console.error('Error fetching schedules:', error);
    return res.status(500).json({ error: 'Failed to fetch schedules' });
  }
};

const updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { isHoliday, availableMeals } = req.body;

    if (!ObjectId.isValid(scheduleId)) {
      return res.status(400).json({ error: 'Invalid schedule ID' });
    }

    if (availableMeals && !Array.isArray(availableMeals)) {
      return res.status(400).json({ error: 'availableMeals must be an array' });
    }

    const updateData = { updatedAt: new Date() };
    let normalizedAvailableMeals;

    if (isHoliday !== undefined) {
      updateData.isHoliday = isHoliday;
    }

    if (availableMeals) {
      normalizedAvailableMeals = availableMeals.map(meal => ({
        mealType: meal.mealType,
        isAvailable: meal.isAvailable,
        customDeadline: meal.customDeadline || null,
        weight: meal.isAvailable ? (meal.weight !== undefined ? meal.weight : 1) : 0,
        menu: meal.menu || ''
      }));
      updateData.availableMeals = normalizedAvailableMeals;
    }

    const { mealSchedules, mealRegistrations, users, systemLogs, monthlyFinalization } = await getCollections();
    const existingSchedule = await mealSchedules.findOne({ _id: new ObjectId(scheduleId) });

    if (!existingSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const scheduleMonth = getMonthFromDate(existingSchedule.date);
    if (!scheduleMonth || !await assertMonthIsOpen(monthlyFinalization, scheduleMonth)) {
      return res.status(400).json({ error: 'Cannot update schedule - month is already finalized' });
    }

    const previousAvailableMealTypes = new Set(
      (existingSchedule.availableMeals || [])
        .filter(meal => meal.isAvailable)
        .map(meal => meal.mealType)
    );

    const newlyAvailableMealTypes = normalizedAvailableMeals
      ? normalizedAvailableMeals
        .filter(meal => meal.isAvailable && !previousAvailableMealTypes.has(meal.mealType))
        .map(meal => meal.mealType)
      : [];

    let registrationsCreated = 0;
    let result;
    const client = await getMongoClient();
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        result = await mealSchedules.findOneAndUpdate(
          { _id: new ObjectId(scheduleId) },
          { $set: updateData },
          { returnDocument: 'after', session }
        );

        if (!result) {
          throw new Error('Schedule not found');
        }

        const unavailableMealTypes = result.availableMeals
          .filter(meal => !meal.isAvailable)
          .map(meal => meal.mealType);
        const deletedRegistrations = unavailableMealTypes.length > 0
          ? await mealRegistrations.find({
            date: result.date,
            mealType: { $in: unavailableMealTypes }
          }, { session }).toArray()
          : [];

        if (deletedRegistrations.length > 0) {
          await mealRegistrations.deleteMany({
            date: result.date,
            mealType: { $in: unavailableMealTypes }
          }, { session });
        }

        const logs = [];
        if (deletedRegistrations.length > 0) {
          const targetUsers = await users.find({
            _id: { $in: deletedRegistrations.map(registration => registration.userId) }
          }, { session }).toArray();
          const targetUsersMap = new Map(targetUsers.map(user => [user._id.toString(), user]));

          deletedRegistrations.forEach(registration => {
            logs.push(buildMealActivityLog({
              action: 'meal_deregistered',
              registration,
              targetUser: targetUsersMap.get(registration.userId.toString()),
              actorUser: systemActor('Schedule change'),
              trigger: 'schedule_update',
              automatic: true,
              createdAt: updateData.updatedAt
            }));
          });
        }

        if (newlyAvailableMealTypes.length > 0) {
          const [defaultUsers, existingRegistrations] = await Promise.all([
            users.find(
              { mealDefault: true, isActive: { $ne: false } },
              { projection: { _id: 1, name: 1, email: 1 }, session }
            ).toArray(),
            mealRegistrations.find({
              date: result.date,
              mealType: { $in: newlyAvailableMealTypes }
            }, { session }).toArray()
          ]);

          const existingRegistrationKeys = new Set(
            existingRegistrations.map(registration => `${registration.userId?.toString()}_${registration.mealType}`)
          );
          const registrationsToCreate = [];
          const registeredAt = new Date();

          for (const user of defaultUsers) {
            for (const mealType of newlyAvailableMealTypes) {
              const key = `${user._id.toString()}_${mealType}`;

              if (!existingRegistrationKeys.has(key)) {
                registrationsToCreate.push({
                  userId: user._id,
                  date: result.date,
                  mealType,
                  numberOfMeals: 1,
                  registeredAt
                });
              }
            }
          }

          if (registrationsToCreate.length > 0) {
            const registrationResult = await mealRegistrations.insertMany(registrationsToCreate, { session });
            registrationsCreated = registrationResult.insertedCount;
            const targetUsersMap = new Map(defaultUsers.map(user => [user._id.toString(), user]));

            registrationsToCreate.forEach((registration, index) => {
              logs.push(buildMealActivityLog({
                action: 'meal_registered',
                registration: { ...registration, _id: registrationResult.insertedIds[index] },
                targetUser: targetUsersMap.get(registration.userId.toString()),
                actorUser: systemActor('Automatic registration'),
                trigger: 'schedule_update',
                automatic: true,
                createdAt: registeredAt
              }));
            });
          }
        }

        await insertActivityLogs(systemLogs, logs, { session });
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      message: 'Schedule and registrations updated successfully',
      schedule: result,
      registrationsCreated
    });

  } catch (error) {
    console.error('Error updating schedule:', error);
    return res.status(500).json({ error: 'Failed to update schedule' });
  }
};

const bulkUpdateSchedules = async (req, res) => {
  try {
    const { schedules } = req.body;

    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ error: 'schedules array is required and cannot be empty' });
    }

    const { mealSchedules, monthlyFinalization } = await getCollections();

    const updatePromises = [];
    const errors = [];

    for (const schedule of schedules) {
      const { scheduleId, isHoliday, availableMeals } = schedule;

      if (!scheduleId || !ObjectId.isValid(scheduleId)) {
        errors.push({ scheduleId, error: 'Invalid schedule ID' });
        continue;
      }

      const updateData = { updatedAt: new Date() };

      if (isHoliday !== undefined) updateData.isHoliday = isHoliday;
      if (availableMeals) updateData.availableMeals = availableMeals;

      updatePromises.push(
        mealSchedules.updateOne(
          { _id: new ObjectId(scheduleId) },
          { $set: updateData }
        )
      );
    }

    const validScheduleIds = schedules
      .filter(schedule => schedule.scheduleId && ObjectId.isValid(schedule.scheduleId))
      .map(schedule => new ObjectId(schedule.scheduleId));

    if (validScheduleIds.length > 0) {
      const existingSchedules = await mealSchedules.find(
        { _id: { $in: validScheduleIds } },
        { projection: { date: 1 } }
      ).toArray();
      const months = [...new Set(existingSchedules.map(schedule => getMonthFromDate(schedule.date)).filter(Boolean))];

      if (!await ensureMonthsAreOpen(monthlyFinalization, months)) {
        return res.status(400).json({ error: 'Cannot update schedules - one or more months are already finalized' });
      }
    }

    const results = await Promise.all(updatePromises);
    const successCount = results.filter(r => r.modifiedCount > 0).length;

    return res.status(200).json({
      message: `${successCount} schedules updated successfully`,
      successCount,
      totalAttempted: schedules.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error bulk updating schedules:', error);
    return res.status(500).json({ error: 'Failed to bulk update schedules' });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    if (!ObjectId.isValid(scheduleId)) {
      return res.status(400).json({ error: 'Invalid schedule ID' });
    }

    const { mealSchedules, mealRegistrations, users, systemLogs, monthlyFinalization } = await getCollections();

    const schedule = await mealSchedules.findOne({
      _id: new ObjectId(scheduleId)
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const scheduleMonth = getMonthFromDate(schedule.date);
    if (!scheduleMonth || !await assertMonthIsOpen(monthlyFinalization, scheduleMonth)) {
      return res.status(400).json({ error: 'Cannot delete schedule - month is already finalized' });
    }

    const client = await getMongoClient();
    const session = client.startSession();
    let deletedCount = 0;

    try {
      await session.withTransaction(async () => {
        const registrations = await mealRegistrations.find(
          { date: schedule.date },
          { session }
        ).toArray();

        await mealSchedules.deleteOne({ _id: new ObjectId(scheduleId) }, { session });
        const deleteResult = await mealRegistrations.deleteMany(
          { date: schedule.date },
          { session }
        );
        deletedCount = deleteResult.deletedCount;

        if (registrations.length > 0) {
          const targetUsers = await users.find({
            _id: { $in: registrations.map(registration => registration.userId) }
          }, { session }).toArray();
          const targetUsersMap = new Map(targetUsers.map(user => [user._id.toString(), user]));
          const logs = registrations.map(registration => buildMealActivityLog({
            action: 'meal_deregistered',
            registration,
            targetUser: targetUsersMap.get(registration.userId.toString()),
            actorUser: systemActor('Schedule deletion'),
            trigger: 'schedule_deletion',
            automatic: true,
            createdAt: new Date()
          }));
          await insertActivityLogs(systemLogs, logs, { session });
        }
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      message: 'Schedule deleted successfully',
      registrationsCleared: deletedCount
    });

  } catch (error) {
    console.error('Error deleting schedule:', error);
    return res.status(500).json({ error: 'Failed to delete schedule' });
  }
};

const getAllRegistrations = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    const { mealRegistrations, users } = await getCollections();

    const registrations = await mealRegistrations.find({
      date: { $gte: start, $lte: end }
    }).sort({ date: 1, userId: 1, mealType: 1 }).toArray();

    const userIds = [...new Set(registrations.map(r => r.userId))];
    const usersMap = {};

    if (userIds.length > 0) {
      const usersList = await users.find({
        _id: { $in: userIds.map(id => new ObjectId(id)) }
      }).toArray();

      usersList.forEach(user => {
        usersMap[user._id.toString()] = { name: user.name, email: user.email };
      });
    }

    const enrichedRegistrations = registrations.map(reg => ({
      ...reg,
      user: usersMap[reg.userId] || null
    }));

    return res.status(200).json({
      count: enrichedRegistrations.length,
      startDate,
      endDate,
      registrations: enrichedRegistrations
    });

  } catch (error) {
    console.error('Error fetching all registrations:', error);
    return res.status(500).json({ error: 'Failed to fetch registrations' });
  }
};

module.exports = {
  generateSchedules,
  getSchedules,
  updateSchedule,
  bulkUpdateSchedules,
  getAllRegistrations,
  deleteSchedule
};
