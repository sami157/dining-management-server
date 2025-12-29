const { ObjectId } = require('mongodb');
const { mealSchedules, mealRegistrations } = require('../../config/connectMongodb');

// Default deadline rules
const MEAL_DEADLINES = {
  morning: { hours: 22, dayOffset: -1 }, // Previous day 10 PM
  evening: { hours: 10, dayOffset: 0 },  // Same day 10 AM
  night: { hours: 15, dayOffset: 0 }     // Same day 3 PM
};

// Helper function to calculate deadline for a meal
const calculateDeadline = (mealDate, mealType, customDeadline) => {
  if (customDeadline) {
    return new Date(customDeadline);
  }

  const config = MEAL_DEADLINES[mealType];
  const deadline = new Date(mealDate);
  deadline.setDate(deadline.getDate() + config.dayOffset);
  deadline.setHours(config.hours, 0, 0, 0);

  return deadline;
};

getAvailableMeals = async (req, res) => {
  try {
    const { startDate, endDate, month } = req.query;
    const userId = req.user?._id || 'temp';
    const currentTime = new Date();

    let start, end;

    // If month is provided, calculate start and end dates
    if (month) {
      const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
      if (!monthRegex.test(month)) {
        return res.status(400).json({
          error: 'month must be in YYYY-MM format (e.g., 2025-01)'
        });
      }

      const [year, monthNum] = month.split('-').map(Number);
      start = new Date(year, monthNum - 1, 1);
      end = new Date(year, monthNum, 0); // Last day of month

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }
    // Otherwise use startDate and endDate
    else {
      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Either month OR both startDate and endDate are required'
        });
      }

      start = new Date(startDate);
      end = new Date(endDate);

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    // Fetch schedules
    const schedules = await mealSchedules.find({
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 }).toArray();

    // Fetch user's existing registrations
    const userRegistrations = await mealRegistrations.find({
      userId: userId,
      date: { $gte: start, $lte: end }
    }).toArray();

    // Create a map of user's registrations for quick lookup
    const registrationMap = {};
    userRegistrations.forEach(reg => {
      const key = `${reg.date.toISOString().split('T')[0]}_${reg.mealType}`;
      registrationMap[key] = reg;
    });

    // Process schedules to add availability info
    const availableMeals = schedules.map(schedule => {
      const meals = schedule.availableMeals.map(meal => {
        const deadline = calculateDeadline(schedule.date, meal.mealType, meal.customDeadline);
        const isDeadlinePassed = currentTime > deadline;
        const registrationKey = `${schedule.date.toISOString().split('T')[0]}_${meal.mealType}`;
        const isRegistered = !!registrationMap[registrationKey];

        return {
          mealType: meal.mealType,
          isAvailable: meal.isAvailable,
          menu: meal.menu || '',
          weight: meal.weight || 1, // Add this
          deadline: deadline,
          canRegister: meal.isAvailable && !isDeadlinePassed && !isRegistered,
          isRegistered: isRegistered,
          registrationId: isRegistered ? registrationMap[registrationKey]._id : null
        };
      });

      return {
        date: schedule.date,
        isHoliday: schedule.isHoliday,
        meals: meals
      };
    });

    return res.status(200).json({
      count: availableMeals.length,
      schedules: availableMeals
    });

  } catch (error) {
    console.error('Error fetching available meals:', error);
    return res.status(500).json({
      error: 'Failed to fetch available meals'
    });
  }
};

registerMeal = async (req, res) => {
  try {
    const { date, mealType } = req.body;
    const userId = req.user?._id || 'temp';
    const currentTime = new Date();

    // Validate inputs
    if (!date || !mealType) {
      return res.status(400).json({
        error: 'date and mealType are required'
      });
    }

    if (!['morning', 'evening', 'night'].includes(mealType)) {
      return res.status(400).json({
        error: 'mealType must be morning, evening, or night'
      });
    }

    const mealDate = new Date(date);
    mealDate.setHours(0, 0, 0, 0);

    // Check if schedule exists for this date
    const schedule = await mealSchedules.findOne({ date: mealDate });

    if (!schedule) {
      return res.status(404).json({
        error: 'No meal schedule found for this date'
      });
    }

    // Find the specific meal
    const meal = schedule.availableMeals.find(m => m.mealType === mealType);

    if (!meal || !meal.isAvailable) {
      return res.status(400).json({
        error: 'This meal is not available on this date'
      });
    }

    // Check deadline
    const deadline = calculateDeadline(mealDate, mealType, meal.customDeadline);
    if (currentTime > deadline) {
      return res.status(400).json({
        error: 'Registration deadline has passed for this meal'
      });
    }

    // Check if user already registered
    const existingRegistration = await mealRegistrations.findOne({
      userId: userId,
      date: mealDate,
      mealType: mealType,
    });

    if (existingRegistration) {
      return res.status(400).json({
        error: 'You have already registered for this meal'
      });
    }

    // Create registration
    const registration = {
      userId: userId,
      date: mealDate,
      mealType: mealType,
      registeredAt: new Date()
    };

    const result = await mealRegistrations.insertOne(registration);

    return res.status(201).json({
      message: 'Meal registered successfully',
      registrationId: result.insertedId,
      registration: { ...registration, _id: result.insertedId }
    });

  } catch (error) {
    console.error('Error registering meal:', error);
    return res.status(500).json({
      error: 'Failed to register meal'
    });
  }
}

cancelMealRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user?._id || 'temp';

    // Validate registrationId
    if (!ObjectId.isValid(registrationId)) {
      return res.status(400).json({
        error: 'Invalid registration ID'
      });
    }

    // Delete the registration
    const result = await mealRegistrations.deleteOne({
      _id: new ObjectId(registrationId),
      userId: userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: 'Registration not found'
      });
    }

    return res.status(200).json({
      message: 'Meal registration cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling meal registration:', error);
    return res.status(500).json({
      error: 'Failed to cancel meal registration'
    });
  }
};

getMyRegistrations = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user?._id || 'temp';

    // Build query
    const query = { userId: userId };

    // Add date range filter if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      query.date = { $gte: start, $lte: end };
    }

    // Fetch registrations
    const registrations = await mealRegistrations.find(query)
      .sort({ date: 1, mealType: 1 })
      .toArray();

    return res.status(200).json({
      count: registrations.length,
      registrations: registrations
    });

  } catch (error) {
    console.error('Error fetching user registrations:', error);
    return res.status(500).json({
      error: 'Failed to fetch registrations'
    });
  }
};


module.exports = {
  getAvailableMeals,
  registerMeal,
  cancelMealRegistration,
  getMyRegistrations,
}