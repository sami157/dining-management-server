const { ObjectId } = require('mongodb');
const { getCollections } = require('../../config/connectMongodb');
const { DINING_IDS, normalizeDiningId } = require('../../config/dining');
const { DateTime } = require('luxon');

// Default deadline rules
const MEAL_DEADLINES = {
  morning: { hours: 22, dayOffset: -1 }, // Previous day 10 PM
  evening: { hours: 8, dayOffset: 0 },  // Same day 8 AM
  night: { hours: 14, dayOffset: 0 }     // Same day 2 PM
};

// Helper function to calculate deadline for a meal
const calculateDeadline = (mealDate, mealType, customDeadline) => {
  if (customDeadline) {
    return new Date(customDeadline);
  }

  const config = MEAL_DEADLINES[mealType];

  return DateTime.fromJSDate(mealDate)
    .setZone("Asia/Dhaka")
    .plus({ days: config.dayOffset })
    .set({ hour: config.hours, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
};

const getAvailableMeals = async (req, res) => {
  try {
    const { startDate, endDate, month } = req.query;
    const userId = req.user?._id;
    const currentTime = new Date();
    let start, end;

    if (month) {
      const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
      if (!monthRegex.test(month)) {
        return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
      }

      const [year, monthNum] = month.split('-').map(Number);
      start = new Date(year, monthNum - 1, 1);
      end = new Date(year, monthNum, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Either month OR both startDate and endDate are required' });
      }

      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    const { mealSchedules, mealRegistrations } = await getCollections();

    const [schedules, userRegistrations] = await Promise.all([
      mealSchedules.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 }).toArray(),
      mealRegistrations.find({ userId, date: { $gte: start, $lte: end } }).toArray()
    ]);

    const registrationMap = {};
    userRegistrations.forEach(reg => {
      const key = `${reg.date.toISOString().split('T')[0]}_${reg.mealType}_${normalizeDiningId(reg.diningId)}`;
      registrationMap[key] = reg;
    });

    const availableMeals = schedules.map(schedule => {
      const meals = schedule.availableMeals.map(meal => {
        const diningId = normalizeDiningId(meal.diningId);
        const deadline = calculateDeadline(schedule.date, meal.mealType, meal.customDeadline);
        const isDeadlinePassed = currentTime > deadline;
        const registrationKey = `${schedule.date.toISOString().split('T')[0]}_${meal.mealType}_${diningId}`;
        const existingRegistration = registrationMap[registrationKey];
        const isRegistered = !!existingRegistration;

        return {
          mealType: meal.mealType,
          diningId,
          isAvailable: meal.isAvailable,
          menu: meal.menu || '',
          weight: meal.weight || 1,
          deadline,
          canRegister: meal.isAvailable && !isDeadlinePassed && !isRegistered,
          isRegistered,
          registrationId: isRegistered ? existingRegistration._id : null,
          numberOfMeals: isRegistered ? existingRegistration.numberOfMeals || 1 : null
        };
      });

      return { date: schedule.date, isHoliday: schedule.isHoliday, meals };
    });

    return res.status(200).json({ count: availableMeals.length, schedules: availableMeals });

  } catch (error) {
    console.error('Error fetching available meals:', error);
    return res.status(500).json({ error: 'Failed to fetch available meals' });
  }
};

const registerMeal = async (req, res) => {
  try {
    const { date, mealType, userId: requestUserId, numberOfMeals } = req.body;
    const diningId = normalizeDiningId(req.body?.diningId);
    let userId = req.user?._id;
    let isLateRegistration = false
    const currentTime = new Date();

    if (requestUserId) {
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Not authorized to register for others' });
      }
      userId = new ObjectId(requestUserId);
    }

    if (!date || !mealType) {
      return res.status(400).json({ error: 'date and mealType are required' });
    }

    if (!['morning', 'evening', 'night'].includes(mealType)) {
      return res.status(400).json({ error: 'mealType must be morning, evening, or night' });
    }

    if (!DINING_IDS.includes(diningId)) {
      return res.status(400).json({ error: `diningId must be one of: ${DINING_IDS.join(', ')}` });
    }

    const mealDate = new Date(date);

    const { mealSchedules, mealRegistrations, users, systemLogs } = await getCollections();

    const schedule = await mealSchedules.findOne({ date: mealDate });
    if (!schedule) {
      return res.status(404).json({ error: 'No meal schedule found for this date' });
    }

    const meal = schedule.availableMeals.find(m => m.mealType === mealType && normalizeDiningId(m.diningId) === diningId);
    if (!meal || !meal.isAvailable) {
      return res.status(400).json({ error: 'This meal is not available at this dining location on this date' });
    }

    if (!requestUserId) {
      const deadline = calculateDeadline(mealDate, mealType, meal.customDeadline);
      if (currentTime > deadline) {
        return res.status(400).json({ error: 'Registration deadline has passed for this meal' });
      }
    }

    const existingRegistration = await mealRegistrations.findOne({ userId, date: mealDate, mealType, diningId });
    if (existingRegistration) {
      return res.status(400).json({ error: 'You have already registered for this meal' });
    }

    const registration = {
      userId,
      date: mealDate,
      diningId,
      mealType,
      numberOfMeals: numberOfMeals || 1,
      registeredAt: new Date()
    };

    const result = await mealRegistrations.insertOne(registration);

    const byPerson = await users.findOne(
      { _id: new ObjectId(req.user?._id) },
      { projection: { name: 1 } }
    );

    const forPerson = await users.findOne(
      { _id: userId },
      { projection: { name: 1 } }
    );

    if (requestUserId) {
      const deadline = calculateDeadline(mealDate, mealType, meal.customDeadline);
      if (currentTime > deadline) {
        isLateRegistration = true
      }
    }

    if (isLateRegistration) {
      const log = {
        type: 'meal-on',
        byPerson,
        forPerson,
        registration,
      }
      await systemLogs.insertOne(log)
    }

    return res.status(201).json({
      message: 'Meal registered successfully',
      registrationId: result.insertedId,
      registration: { ...registration, _id: result.insertedId }
    });

  } catch (error) {
    console.error('Error registering meal:', error);
    return res.status(500).json({ error: 'Failed to register meal' });
  }
};

const updateMealRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { numberOfMeals } = req.body;
    const userId = req.user?._id;

    if (!ObjectId.isValid(registrationId)) {
      return res.status(400).json({ error: 'Invalid registration ID' });
    }

    if (!numberOfMeals || typeof numberOfMeals !== 'number' || numberOfMeals < 1) {
      return res.status(400).json({ error: 'numberOfMeals must be a positive number' });
    }

    const { mealRegistrations, mealSchedules } = await getCollections();

    const registration = await mealRegistrations.findOne({ _id: new ObjectId(registrationId) });
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (!registration.userId.equals(userId) && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'You can only update your own registration' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      const schedule = await mealSchedules.findOne({ date: registration.date });
      if (!schedule) {
        return res.status(404).json({ error: 'Meal schedule not found for this date' });
      }

      const mealConfig = schedule.availableMeals.find(m => m.mealType === registration.mealType);
      if (!mealConfig || !mealConfig.isAvailable) {
        return res.status(400).json({ error: 'Meal is no longer available for modification' });
      }

      const deadline = calculateDeadline(new Date(registration.date), registration.mealType, null);
      if (new Date() > deadline) {
        return res.status(400).json({ error: 'Deadline has passed. Changes are no longer allowed.' });
      }
    }

    await mealRegistrations.updateOne(
      { _id: new ObjectId(registrationId) },
      { $set: { numberOfMeals, updatedAt: new Date() } }
    );

    return res.status(200).json({ message: 'Registration updated successfully' });

  } catch (error) {
    console.error('Error updating meal registration:', error);
    return res.status(500).json({ error: 'Failed to update meal registration' });
  }
};

const cancelMealRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user?._id;

    if (!ObjectId.isValid(registrationId)) {
      return res.status(400).json({ error: 'Invalid registration ID' });
    }

    const { users, mealRegistrations, mealSchedules, systemLogs } = await getCollections();

    const user = await users.findOne({ _id: userId });

    const registration = await mealRegistrations.findOne({ _id: new ObjectId(registrationId) });
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      const schedule = await mealSchedules.findOne({ date: registration.date });
      if (!schedule) {
        return res.status(404).json({ error: 'Meal schedule not found' });
      }

      const meal = schedule.availableMeals.find(m => m.mealType === registration.mealType);
      if (!meal) {
        return res.status(400).json({ error: 'Meal configuration not found' });
      }

      const deadline = calculateDeadline(registration.date, registration.mealType, meal.customDeadline);
      if (new Date() > deadline) {
        return res.status(400).json({ error: 'Cancellation deadline has passed for this meal' });
      }

      if (!registration.userId.equals(userId)) {
        return res.status(403).json({ error: 'You can only cancel your own registration' });
      }
    }

    const byPerson = await users.findOne(
      { _id: new ObjectId(req.user?._id) },
      { projection: { name: 1 } }
    );

    const forPerson = await users.findOne(
      { _id: registration.userId },
      { projection: { name: 1 } }
    );

    if (!registration.userId.equals(userId)) {
      const log = {
        type: 'meal-off',
        byPerson,
        forPerson,
        mealDate: registration.mealDate,
        mealType: registration.mealType,
        cancelledAt: new Date()
      }
      await systemLogs.insertOne(log)
    }

    await mealRegistrations.deleteOne({ _id: new ObjectId(registrationId) });

    return res.status(200).json({ message: 'Meal registration cancelled successfully' });

  } catch (error) {
    console.error('Error cancelling meal registration:', error);
    return res.status(500).json({ error: 'Failed to cancel meal registration' });
  }
};

const getMyRegistrations = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user?._id;

    const query = { userId };

    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const { mealRegistrations } = await getCollections();
    const registrations = await mealRegistrations.find(query)
      .sort({ date: 1, mealType: 1 })
      .toArray();

    return res.status(200).json({ count: registrations.length, registrations });

  } catch (error) {
    console.error('Error fetching user registrations:', error);
    return res.status(500).json({ error: 'Failed to fetch registrations' });
  }
};

const getTotalMealsForUser = async (req, res) => {
  try {
    const { email } = req.params;
    const { month } = req.query;

    const { users, mealRegistrations, mealSchedules } = await getCollections();

    const user = await users.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (month) {
      const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
      if (!monthRegex.test(month)) {
        return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
      }
    }

    let start, end;

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
      if (schedule) {
        const meal = schedule.availableMeals.find(m => m.mealType === registration.mealType);
        if (meal) {
          const weight = meal.weight || 1;
          const numberOfMeals = registration.numberOfMeals || 1;
          totalMeals += numberOfMeals * weight;
          mealBreakdown[registration.mealType] += numberOfMeals * weight;
        }
      }
    }

    const currentMonth = month || `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

    return res.status(200).json({
      userId: user._id,
      userName: user.name,
      email: user.email,
      month: currentMonth,
      totalMeals,
      mealCount: registrations.length,
      breakdown: mealBreakdown,
      registrations: registrations.length
    });

  } catch (error) {
    console.error('Error calculating total meals:', error);
    return res.status(500).json({ error: 'Failed to calculate total meals' });
  }
};

const bulkToggleMealsForUser = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { month } = req.query; // format: "2026-03"

    if (!month) {
      return res.status(400).json({ error: 'month is required (format: YYYY-MM)' });
    }

    const [year, monthIndex] = month.split('-').map(Number);
    const monthStart = new Date(Date.UTC(year, monthIndex - 1, 1));
    const monthEnd = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));

    const currentTime = new Date();
    const { mealSchedules, mealRegistrations } = await getCollections();

    // Fetch all non-holiday schedules and existing user registrations for the month in parallel
    const [schedules, existingRegistrations] = await Promise.all([
      mealSchedules.find({
        date: { $gte: monthStart, $lte: monthEnd },
      }).toArray(),
      mealRegistrations.find({
        userId,
        date: { $gte: monthStart, $lte: monthEnd },
      }).toArray(),
    ]);

    // Build a set of already-registered (date + mealType) pairs
    const registeredSet = new Set(
      existingRegistrations.map(r => `${r.date.toISOString()}_${r.mealType}_${normalizeDiningId(r.diningId)}`)
    );

    const toInsert = [];

    for (const schedule of schedules) {
      for (const meal of schedule.availableMeals) {
        if (!meal.isAvailable) continue;

        const diningId = normalizeDiningId(meal.diningId);
        const key = `${schedule.date.toISOString()}_${meal.mealType}_${diningId}`;
        if (registeredSet.has(key)) continue;

        const deadline = calculateDeadline(schedule.date, meal.mealType, meal.customDeadline);
        if (currentTime > deadline) continue;

        toInsert.push({
          userId,
          date: schedule.date,
          diningId,
          mealType: meal.mealType,
          numberOfMeals: 1,
          registeredAt: new Date(),
        });
      }
    }

    if (toInsert.length === 0) {
      return res.status(200).json({
        message: 'No available meals to register for',
        registeredCount: 0,
      });
    }

    await mealRegistrations.insertMany(toInsert);

    return res.status(201).json({
      message: `Successfully registered for ${toInsert.length} meals`,
      registeredCount: toInsert.length,
    });

  } catch (error) {
    console.error('Error in bulk toggling:', error);
    return res.status(500).json({ error: 'Failed to toggle meals' });
  }
};

module.exports = {
  getAvailableMeals,
  registerMeal,
  updateMealRegistration,
  cancelMealRegistration,
  getMyRegistrations,
  getTotalMealsForUser,
  bulkToggleMealsForUser
};
