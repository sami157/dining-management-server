const { ObjectId } = require('mongodb');
const { mealSchedules, mealRegistrations, users } = require('../../config/connectMongodb');

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
    const userId = req.user?._id
    const currentTime = new Date();

    if (month) {
      const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
      if (!monthRegex.test(month)) {
        return res.status(400).json({
          error: 'month must be in YYYY-MM format (e.g., 2025-01)'
        });
      }

      const [year, monthNum] = month.split('-').map(Number);
      start = new Date(year, monthNum - 1, 1);
      end = new Date(year, monthNum, 0);
      
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
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
      userId,
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
    const { date, mealType, userId: requestUserId } = req.body;
    let userId = req.user?._id
    // Allow manager to register for any user, otherwise use authenticated user
    requestUserId ? userId = new ObjectId(requestUserId) : userId = req.user?._id
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
    mealDate.setHours(12, 0, 0, 0);

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
    if(!requestUserId){
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

cancelMealRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;

    // Validate registrationId
    if (!ObjectId.isValid(registrationId)) {
      return res.status(400).json({
        error: 'Invalid registration ID'
      });
    }

    // Delete the registration (no userId check - allows manager to delete any registration)
    const result = await mealRegistrations.deleteOne({
      _id: new ObjectId(registrationId)
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
    const userId = req.user?._id

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

getTotalMealsForUser = async (req, res) => {
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
      
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      // If no month provided, calculate for current month
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
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
    for (const registration of registrations) {
      const schedule = await mealSchedules.findOne({
        date: registration.date
      });

      if (schedule) {
        const meal = schedule.availableMeals.find(m => m.mealType === registration.mealType);
        if (meal) {
          const weight = meal.weight || 1;
          totalMeals += weight;
          mealBreakdown[registration.mealType] += weight;
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
  cancelMealRegistration,
  getMyRegistrations,
  getTotalMealsForUser
}