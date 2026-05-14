const { ObjectId } = require('mongodb');
const { getCollections } = require('../../config/connectMongodb');
const { DINING_IDS, DEFAULT_DINING_ID, normalizeDiningId, getMealDefaultField } = require('../../config/dining');
const { DELIVERY_LOCATIONS, normalizeDeliveryLocation } = require('../../config/delivery');

const DEFAULT_MEAL_CATEGORY = 'basic';

// Helper function to check if a date is weekend (Fri or Sat)
const isWeekend = (date) => {
  const day = date.getDay(); // 0 to 6, 0 = Sun
  return day === 5 || day === 6;
};

const buildDiningMeal = (mealType, diningId, weight) => ({
  mealType,
  isAvailable: true,
  diningId,
  customDeadline: null,
  weight,
  menu: ''
});

// Helper function to get the full daily meal pattern. The schedule is common,
// and each meal carries the dining location where it will be served.
const getDefaultMeals = (date, isHoliday) => {
  const isWeekendOrHoliday = isWeekend(date) || isHoliday;

  if (isWeekendOrHoliday) {
    return [
      buildDiningMeal('morning', 'township', 0.5),
      buildDiningMeal('evening', 'township', 1),
      buildDiningMeal('night', 'township', 1)
    ];
  }

  return [
    buildDiningMeal('morning', 'office', 0.5),
    buildDiningMeal('evening', 'office', 1),
    buildDiningMeal('night', 'township', 1)
  ];
};

const getRegistrationDiningQuery = (diningId = DEFAULT_DINING_ID) => ({ diningId: normalizeDiningId(diningId) });

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

    const { mealSchedules, mealRegistrations, mealDeliveryRequests, users } = await getCollections();

    // Fetch existing schedules and default users for both dining locations in parallel.
    const [existingSchedules, townshipDefaultUsers, officeDefaultUsers] = await Promise.all([
      mealSchedules.find(
        { date: { $gte: start, $lte: end } },
        { projection: { date: 1 } }
      ).toArray(),
      users.find(
        { mealDefault: true, isActive: { $ne: false } },
        { projection: { _id: 1 } }
      ).toArray(),
      users.find(
        { mealDefaultOffice: true, isActive: { $ne: false } },
        { projection: { _id: 1 } }
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

    const result = await mealSchedules.insertMany(schedulesToCreate);

    let registrationsCreated = 0;

    // Auto-register default users for each new schedule
    const defaultUsersByDining = {
      township: townshipDefaultUsers,
      office: officeDefaultUsers
    };
    const registrations = [];

    for (const schedule of schedulesToCreate) {
      const availableMeals = schedule.availableMeals.filter(meal => meal.isAvailable);

      for (const meal of availableMeals) {
        const defaultUsers = defaultUsersByDining[meal.diningId] || [];

        for (const user of defaultUsers) {
          registrations.push({
            userId: user._id,
            date: schedule.date,
            diningId: meal.diningId,
            mealType: meal.mealType,
            mealCategory: DEFAULT_MEAL_CATEGORY,
            numberOfMeals: 1,
            registeredAt: new Date()
          });
        }
      }
    }

    if (registrations.length > 0) {
      const registrationResult = await mealRegistrations.insertMany(registrations);
      registrationsCreated = registrationResult.insertedCount;
    }

    return res.status(201).json({
      message: `${result.insertedCount} schedules created successfully`,
      count: result.insertedCount,
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
    const diningId = req.query.diningId ? normalizeDiningId(req.query.diningId) : null;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    if (diningId && !DINING_IDS.includes(diningId)) {
      return res.status(400).json({ error: `diningId must be one of: ${DINING_IDS.join(', ')}` });
    }

    const query = { date: { $gte: start, $lte: end } };
    if (diningId) {
      query.availableMeals = { $elemMatch: { diningId, isAvailable: true } };
    }

    const { mealSchedules } = await getCollections();
    const schedules = await mealSchedules.find(query).sort({ date: 1 }).toArray();

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

    const { mealSchedules, mealRegistrations, users } = await getCollections();
    const existingSchedule = await mealSchedules.findOne({ _id: new ObjectId(scheduleId) });

    if (!existingSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const previousMealsByType = new Map(
      (existingSchedule.availableMeals || []).map(meal => [meal.mealType, meal])
    );

    if (availableMeals) {
      const invalidMeal = availableMeals.find((meal) => {
        const previousMeal = previousMealsByType.get(meal.mealType);
        const diningId = normalizeDiningId(meal.diningId || previousMeal?.diningId);
        return !DINING_IDS.includes(diningId);
      });

      if (invalidMeal) {
        return res.status(400).json({ error: `diningId must be one of: ${DINING_IDS.join(', ')}` });
      }

      normalizedAvailableMeals = availableMeals.map(meal => {
        const previousMeal = previousMealsByType.get(meal.mealType);
        const diningId = normalizeDiningId(meal.diningId || previousMeal?.diningId);

        return {
          mealType: meal.mealType,
          isAvailable: meal.isAvailable,
          diningId,
          customDeadline: meal.customDeadline || null,
          weight: meal.isAvailable ? (meal.weight !== undefined ? meal.weight : 1) : 0,
          menu: meal.menu || ''
        };
      });
      updateData.availableMeals = normalizedAvailableMeals;
    }

    const result = await mealSchedules.findOneAndUpdate(
      { _id: new ObjectId(scheduleId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const mealsToClear = normalizedAvailableMeals
      ? normalizedAvailableMeals
        .filter((meal) => {
          const previousMeal = previousMealsByType.get(meal.mealType);
          if (!previousMeal?.isAvailable) return false;
          return !meal.isAvailable;
        })
        .map(meal => meal.mealType)
      : [];

    if (mealsToClear.length > 0) {
      await mealRegistrations.deleteMany({
        date: result.date,
        mealType: { $in: mealsToClear }
      });
      await mealDeliveryRequests.deleteMany({
        date: result.date,
        mealType: { $in: mealsToClear }
      });
    }

    const mealsToMove = normalizedAvailableMeals
      ? normalizedAvailableMeals
        .filter((meal) => {
          const previousMeal = previousMealsByType.get(meal.mealType);
          return previousMeal?.isAvailable
            && meal.isAvailable
            && normalizeDiningId(previousMeal.diningId) !== meal.diningId;
        })
      : [];

    let registrationsMoved = 0;

    for (const meal of mealsToMove) {
      const moveResult = await mealRegistrations.updateMany(
        { date: result.date, mealType: meal.mealType },
        { $set: { diningId: meal.diningId, updatedAt: new Date() } }
      );
      await mealDeliveryRequests.updateMany(
        { date: result.date, mealType: meal.mealType },
        { $set: { diningId: meal.diningId, updatedAt: new Date() } }
      );
      registrationsMoved += moveResult.modifiedCount;
    }

    const mealsNeedingRegistration = normalizedAvailableMeals
      ? normalizedAvailableMeals
        .filter((meal) => {
          if (!meal.isAvailable) return false;
          const previousMeal = previousMealsByType.get(meal.mealType);
          return !previousMeal?.isAvailable;
        })
      : [];

    let registrationsCreated = 0;

    if (mealsNeedingRegistration.length > 0) {
      const diningIds = [...new Set(mealsNeedingRegistration.map(meal => meal.diningId))];
      const defaultUsersByDining = {};

      await Promise.all(diningIds.map(async (diningId) => {
        defaultUsersByDining[diningId] = await users.find(
          { [getMealDefaultField(diningId)]: true, isActive: { $ne: false } },
          { projection: { _id: 1 } }
        ).toArray();
      }));

      const existingRegistrations = await mealRegistrations.find({
        date: result.date,
        mealType: { $in: mealsNeedingRegistration.map(meal => meal.mealType) },
        diningId: { $in: diningIds }
      }).toArray();

      const existingRegistrationKeys = new Set(
        existingRegistrations.map(registration => `${registration.userId?.toString()}_${registration.mealType}_${registration.diningId}`)
      );

      const registrationsToCreate = [];

      for (const meal of mealsNeedingRegistration) {
        const defaultUsers = defaultUsersByDining[meal.diningId] || [];

        for (const user of defaultUsers) {
          const key = `${user._id.toString()}_${meal.mealType}_${meal.diningId}`;

          if (!existingRegistrationKeys.has(key)) {
            registrationsToCreate.push({
              userId: user._id,
              date: result.date,
              diningId: meal.diningId,
              mealType: meal.mealType,
              mealCategory: DEFAULT_MEAL_CATEGORY,
              numberOfMeals: 1,
              registeredAt: new Date()
            });
          }
        }
      }

      if (registrationsToCreate.length > 0) {
        const registrationResult = await mealRegistrations.insertMany(registrationsToCreate);
        registrationsCreated = registrationResult.insertedCount;
      }
    }

    return res.status(200).json({
      message: 'Schedule and registrations updated successfully',
      schedule: result,
      registrationsMoved,
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

    const { mealSchedules } = await getCollections();

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

    const { mealSchedules, mealRegistrations, mealDeliveryRequests } = await getCollections();

    const schedule = await mealSchedules.findOneAndDelete({
      _id: new ObjectId(scheduleId)
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const { deletedCount } = await mealRegistrations.deleteMany({
      date: schedule.date
    });
    await mealDeliveryRequests.deleteMany({
      date: schedule.date
    });

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
    const diningId = req.query.diningId ? normalizeDiningId(req.query.diningId) : null;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    if (diningId && !DINING_IDS.includes(diningId)) {
      return res.status(400).json({ error: `diningId must be one of: ${DINING_IDS.join(', ')}` });
    }

    const query = { date: { $gte: start, $lte: end } };
    if (diningId) {
      Object.assign(query, getRegistrationDiningQuery(diningId));
    }

    const { mealRegistrations, users } = await getCollections();

    const registrations = await mealRegistrations.find(query).sort({ date: 1, diningId: 1, userId: 1, mealType: 1 }).toArray();

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
      mealCategory: reg.mealCategory || DEFAULT_MEAL_CATEGORY,
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

const getDeliveryRequests = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const diningId = req.query.diningId ? normalizeDiningId(req.query.diningId) : null;
    const deliveryLocation = req.query.deliveryLocation ? normalizeDeliveryLocation(req.query.deliveryLocation) : null;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    if (diningId && !DINING_IDS.includes(diningId)) {
      return res.status(400).json({ error: `diningId must be one of: ${DINING_IDS.join(', ')}` });
    }

    if (deliveryLocation && !DELIVERY_LOCATIONS.includes(deliveryLocation)) {
      return res.status(400).json({ error: `deliveryLocation must be one of: ${DELIVERY_LOCATIONS.join(', ')}` });
    }

    const query = { date: { $gte: start, $lte: end } };
    if (diningId) query.diningId = diningId;
    if (deliveryLocation) query.deliveryLocation = deliveryLocation;

    const { mealDeliveryRequests, users } = await getCollections();
    const deliveryRequests = await mealDeliveryRequests
      .find(query)
      .sort({ date: 1, deliveryLocation: 1, diningId: 1, mealType: 1 })
      .toArray();

    const userIds = [...new Set(deliveryRequests.map(request => request.userId?.toString()).filter(id => id && ObjectId.isValid(id)))]
      .map(id => new ObjectId(id));
    const usersMap = {};

    if (userIds.length > 0) {
      const usersList = await users.find({ _id: { $in: userIds } }).toArray();
      usersList.forEach(user => {
        usersMap[user._id.toString()] = { name: user.name, email: user.email, room: user.room, building: user.building };
      });
    }

    const enrichedRequests = deliveryRequests.map(request => ({
      ...request,
      user: usersMap[request.userId?.toString()] || null
    }));

    return res.status(200).json({
      count: enrichedRequests.length,
      startDate,
      endDate,
      deliveryRequests: enrichedRequests
    });
  } catch (error) {
    console.error('Error fetching delivery requests:', error);
    return res.status(500).json({ error: 'Failed to fetch delivery requests' });
  }
};

module.exports = {
  generateSchedules,
  getSchedules,
  updateSchedule,
  bulkUpdateSchedules,
  getAllRegistrations,
  getDeliveryRequests,
  deleteSchedule
};
