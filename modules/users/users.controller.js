const { ObjectId } = require('mongodb');
const { mealSchedules, mealRegistrations, users } = require('../../config/connectMongodb');
const { DateTime } = require('luxon');

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

  const deadline = DateTime.fromJSDate(mealDate)
    .setZone("Asia/Dhaka")
    .plus({ days: config.dayOffset })
    .set({ hour: config.hours, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();

  return deadline;
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
        return res.status(400).json({
          error: 'month must be in YYYY-MM format (e.g., 2025-01)'
        });
      }

      const [year, monthNum] = month.split('-').map(Number);
      start = new Date(year, monthNum - 1, 1);
      end = new Date(year, monthNum, 0); // last day of the month
      end.setHours(23, 59, 59, 999);
    } else {
      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Either month OR both startDate and endDate are required'
        });
      }

      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    // Fetch schedules and user registrations in parallel
    const [schedules, userRegistrations] = await Promise.all([
      mealSchedules.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 }).toArray(),
      mealRegistrations.find({ userId, date: { $gte: start, $lte: end } }).toArray()
    ]);

    // Create a map of user's registrations for quick lookup
    const registrationMap = {};
    userRegistrations.forEach(reg => {
      const key = `${reg.date.toISOString().split('T')[0]}_${reg.mealType}`;
      registrationMap[key] = reg;
    });

    const availableMeals = schedules.map(schedule => {
      const meals = schedule.availableMeals.map(meal => {
        const deadline = calculateDeadline(schedule.date, meal.mealType, meal.customDeadline);
        const isDeadlinePassed = currentTime > deadline;
        const registrationKey = `${schedule.date.toISOString().split('T')[0]}_${meal.mealType}`;
        const existingRegistration = registrationMap[registrationKey];
        const isRegistered = !!existingRegistration;

        return {
          mealType: meal.mealType,
          isAvailable: meal.isAvailable,
          menu: meal.menu || '',
          weight: meal.weight || 1,
          deadline: deadline,
          canRegister: meal.isAvailable && !isDeadlinePassed && !isRegistered,
          isRegistered: isRegistered,
          registrationId: isRegistered ? existingRegistration._id : null,
          numberOfMeals: isRegistered ? existingRegistration.numberOfMeals || 1 : null
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

const registerMeal = async (req, res) => {
  try {
    const { date, mealType, userId: requestUserId, numberOfMeals } = req.body;
    let userId = req.user?._id

    // Allow manager to register for any user, otherwise use authenticated user
    if (requestUserId) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Not authorized to register for others'
        });
      }
      userId = new ObjectId(requestUserId);
    }

    const currentTime = new Date()


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
    // mealDate.setHours(0, 0, 0, 0);

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

    // Check deadline only if registration requetsed by user
    if (!requestUserId) {
      const deadline = calculateDeadline(mealDate, mealType, meal.customDeadline);
      if (currentTime > deadline) {
        return res.status(400).json({
          error: 'Registration deadline has passed for this meal'
        });
      }
    }

    // Check if user already registered
    const existingRegistration = await mealRegistrations.findOne({
      userId,
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
      userId,
      date: mealDate,
      mealType: mealType,
      numberOfMeals: numberOfMeals || 1,
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

    const registration = await mealRegistrations.findOne({
      _id: new ObjectId(registrationId)
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Prevent updating others' registration unless admin
    if (!registration.userId.equals(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only update your own registration' });
    }

    // ... inside updateMealRegistration ...

    if (req.user.role !== 'admin') {
      const schedule = await mealSchedules.findOne({ date: registration.date });

      if (!schedule) {
        return res.status(404).json({ error: 'Meal schedule not found for this date' });
      }

      const mealConfig = schedule.availableMeals.find(m => m.mealType === registration.mealType);

      // Check both if meal exists AND if it is currently available/active
      if (!mealConfig || !mealConfig.isAvailable) {
        return res.status(400).json({ error: 'Meal is no longer available for modification' });
      }

      const deadline = calculateDeadline(
        new Date(registration.date), // Wrap to be safe
        registration.mealType,
        null
      );

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
      return res.status(400).json({
        error: 'Invalid registration ID'
      });
    }

    const user = await users.findOne({ _id: userId });

    const registration = await mealRegistrations.findOne({
      _id: new ObjectId(registrationId)
    });

    if (!registration) {
      return res.status(404).json({
        error: 'Registration not found'
      });
    }

    // Admin can cancel anytime (override rule)
    if (user.role !== 'admin') {

      // Find schedule for that date
      const schedule = await mealSchedules.findOne({
        date: registration.date
      });

      if (!schedule) {
        return res.status(404).json({
          error: 'Meal schedule not found'
        });
      }

      const meal = schedule.availableMeals.find(
        m => m.mealType === registration.mealType
      );

      if (!meal) {
        return res.status(400).json({
          error: 'Meal configuration not found'
        });
      }

      // Recalculate deadline
      const deadline = calculateDeadline(
        registration.date,
        registration.mealType,
        meal.customDeadline
      );

      const currentTime = new Date();

      if (currentTime > deadline) {
        return res.status(400).json({
          error: 'Cancellation deadline has passed for this meal'
        });
      }

      // Also prevent user from cancelling others' registration
      if (!registration.userId.equals(userId)) {
        return res.status(403).json({
          error: 'You can only cancel your own registration'
        });
      }
    }

    await mealRegistrations.deleteOne({
      _id: new ObjectId(registrationId)
    });

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


const getMyRegistrations = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user?._id

    // Build query
    const query = { userId: userId };

    // Add date range filter if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // start.setHours(0, 0, 0, 0);
      // end.setHours(23, 59, 59, 999);

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

const getTotalMealsForUser = async (req, res) => {
  try {
    const { email } = req.params; // User ID
    const { month } = req.query; // Format: YYYY-MM (e.g., "2025-01")

    // Find user by email
    const user = await users.findOne({ email });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Validate month format if provided
    if (month) {
      const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
      if (!monthRegex.test(month)) {
        return res.status(400).json({
          error: 'month must be in YYYY-MM format (e.g., 2025-01)'
        });
      }
    }

    let start, end;

    if (month) {
      // Calculate date range for the month
      const [year, monthNum] = month.split('-').map(Number);
      start = new Date(year, monthNum - 1, 1);
      end = new Date(year, monthNum, 0); // Last day of month

      // start.setHours(0, 0, 0, 0);
      // end.setHours(23, 59, 59, 999);
    } else {
      // If no month provided, calculate for current month
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // start.setHours(0, 0, 0, 0);
      // end.setHours(23, 59, 59, 999);
    }

    // Fetch user's registrations for the month using user._id
    const registrations = await mealRegistrations.find({
      userId: user._id, // Convert ObjectId to string if needed
      date: { $gte: start, $lte: end }
    }).toArray();

    // Calculate total meals based on weight
    let totalMeals = 0;
    const mealBreakdown = {
      morning: 0,
      evening: 0,
      night: 0
    };

    // For each registration, get the meal weight from schedule
    const schedules = await mealSchedules.find({
      date: { $gte: start, $lte: end }
    }).toArray();

    const scheduleMap = {};
    for (const schedule of schedules) {
      scheduleMap[schedule.date.toISOString()] = schedule;
    }

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

    return res.status(200).json({
      userId: user._id,
      userName: user.name,
      email: user.email,
      month: month || format(start, 'yyyy-MM'),
      totalMeals: totalMeals,
      mealCount: registrations.length,
      breakdown: mealBreakdown,
      registrations: registrations.length
    });

  } catch (error) {
    console.error('Error calculating total meals:', error);
    return res.status(500).json({
      error: 'Failed to calculate total meals'
    });
  }
};

module.exports = {
  getAvailableMeals,
  registerMeal,
  updateMealRegistration,
  cancelMealRegistration,
  getMyRegistrations,
  getTotalMealsForUser
}