const { ObjectId } = require('mongodb');
const { mealSchedules, mealRegistrations, users } = require('../../config/connectMongodb'); // Adjust path

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

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Start and end dates are required' 
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // // IMPORTANT: Set to noon to avoid timezone issues
    // start.setHours(0, 0, 0, 0);
    // end.setHours(0, 0, 0, 0);

    if (start > end) {
      return res.status(400).json({ 
        error: 'startDate must be before endDate' 
      });
    }

    const schedulesToCreate = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateToCheck = new Date(currentDate);
      // dateToCheck.setHours(0, 0, 0, 0); // Keep at noon

      const existingSchedule = await mealSchedules.findOne({
        date: dateToCheck
      });

      if (!existingSchedule) {
        const schedule = {
          date: dateToCheck,
          isHoliday: false,
          availableMeals: getDefaultMeals(currentDate, false),
          createdBy: managerId,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        schedulesToCreate.push(schedule);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (schedulesToCreate.length > 0) {
      const result = await mealSchedules.insertMany(schedulesToCreate);
      return res.status(201).json({
        message: `${result.insertedCount} schedules created successfully`,
        count: result.insertedCount
      });
    } else {
      return res.status(200).json({
        message: 'All schedules already exist for this date range',
        count: 0
      });
    }

  } catch (error) {
    console.error('Error generating schedules:', error);
    return res.status(500).json({ 
      error: 'Failed to generate schedules' 
    });
  }
};

const getSchedules = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate inputs
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate are required' 
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // start.setHours(0, 0, 0, 0);
    // end.setHours(23, 59, 59, 999);

    if (start > end) {
      return res.status(400).json({ 
        error: 'startDate must be before endDate' 
      });
    }

    // Fetch schedules within date range
    const schedules = await mealSchedules.find({
      date: {
        $gte: start,
        $lte: end
      }
    })
    .sort({ date: 1 }) // Sort by date ascending
    .toArray();

    return res.status(200).json({
      count: schedules.length,
      schedules: schedules
    });

  } catch (error) {
    console.error('Error fetching schedules:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch schedules' 
    });
  }
};

const updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { isHoliday, availableMeals } = req.body;

    if (!ObjectId.isValid(scheduleId)) {
      return res.status(400).json({ 
        error: 'Invalid schedule ID' 
      });
    }

    if (availableMeals && !Array.isArray(availableMeals)) {
      return res.status(400).json({ 
        error: 'availableMeals must be an array' 
      });
    }

    const updateData = {
      updatedAt: new Date()
    };

    if (isHoliday !== undefined) {
      updateData.isHoliday = isHoliday;
    }

    if (availableMeals) {
      // Ensure weight is included when updating
      const processedMeals = availableMeals.map(meal => ({
        mealType: meal.mealType,
        isAvailable: meal.isAvailable,
        customDeadline: meal.customDeadline || null,
        weight: meal.weight !== undefined ? meal.weight : 1, // Default weight if missing
        menu: meal.menu || ''
      }));
      
      updateData.availableMeals = processedMeals;
    }

    const result = await mealSchedules.findOneAndUpdate(
      { _id: new ObjectId(scheduleId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ 
        error: 'Schedule not found' 
      });
    }

    return res.status(200).json({
      message: 'Schedule updated successfully',
      schedule: result
    });

  } catch (error) {
    console.error('Error updating schedule:', error);
    return res.status(500).json({ 
      error: 'Failed to update schedule' 
    });
  }
};

const bulkUpdateSchedules = async (req, res) => {
  try {
    const { schedules } = req.body;

    // Validate input
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ 
        error: 'schedules array is required and cannot be empty' 
      });
    }

    const updatePromises = [];
    const errors = [];

    // Process each schedule update
    for (const schedule of schedules) {
      const { scheduleId, isHoliday, availableMeals } = schedule;

      // Validate scheduleId
      if (!scheduleId || !ObjectId.isValid(scheduleId)) {
        errors.push({ scheduleId, error: 'Invalid schedule ID' });
        continue;
      }

      // Build update object
      const updateData = {
        updatedAt: new Date()
      };

      if (isHoliday !== undefined) {
        updateData.isHoliday = isHoliday;
      }

      if (availableMeals) {
        updateData.availableMeals = availableMeals;
      }

      // Add update operation to promises array
      updatePromises.push(
        mealSchedules.updateOne(
          { _id: new ObjectId(scheduleId) },
          { $set: updateData }
        )
      );
    }

    // Execute all updates
    const results = await Promise.all(updatePromises);
    
    // Count successful updates
    const successCount = results.filter(r => r.modifiedCount > 0).length;

    return res.status(200).json({
      message: `${successCount} schedules updated successfully`,
      successCount: successCount,
      totalAttempted: schedules.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error bulk updating schedules:', error);
    return res.status(500).json({ 
      error: 'Failed to bulk update schedules' 
    });
  }
};

const getAllRegistrations = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate inputs
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate query parameters are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // start.setHours(0, 0, 0, 0);
    // end.setHours(23, 59, 59, 999);

    if (start > end) {
      return res.status(400).json({
        error: 'startDate must be before endDate'
      });
    }

    // Fetch all registrations within date range
    const registrations = await mealRegistrations.find({
      date: {
        $gte: start,
        $lte: end
      }
    })
    .sort({ date: 1, userId: 1, mealType: 1 })
    .toArray();

    // Optional: Populate user details
    const userIds = [...new Set(registrations.map(r => r.userId))];
    const usersMap = {};
    
    if (userIds.length > 0) {
      const usersList = await users.find({
        _id: { $in: userIds.map(id => new ObjectId(id)) }
      }).toArray();
      
      usersList.forEach(user => {
        usersMap[user._id.toString()] = {
          name: user.name,
          email: user.email
        };
      });
    }

    // Enrich registrations with user info
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
    return res.status(500).json({
      error: 'Failed to fetch registrations'
    });
  }
};

module.exports = {
  generateSchedules,
  getSchedules,
  updateSchedule,
  bulkUpdateSchedules,
  getAllRegistrations
}