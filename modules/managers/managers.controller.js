const { ObjectId } = require('mongodb');
const { mealScheduleCollection } = require('../../config/connectMongodb'); // Adjust path

// Helper function to check if a date is weekend (Fri or Sat)
const isWeekend = (date) => {
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  return day === 5 || day === 6; // Friday or Saturday
};

// Helper function to get available meals based on day type
const getDefaultMeals = (date, isHoliday) => {
  const meals = [];
  
  if (isWeekend(date) || isHoliday) {
    // Weekend or holiday: all 3 meals
    meals.push(
      { mealType: 'morning', isAvailable: true, customDeadline: null },
      { mealType: 'evening', isAvailable: true, customDeadline: null },
      { mealType: 'night', isAvailable: true, customDeadline: null }
    );
  } else {
    // Weekday: night meal only
    meals.push(
      { mealType: 'morning', isAvailable: false, customDeadline: null },
      { mealType: 'evening', isAvailable: false, customDeadline: null },
      { mealType: 'night', isAvailable: true, customDeadline: null }
    );
  }
  
  return meals;
};

exports.generateSchedules = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const managerId = new ObjectId(req.user._id); // Assuming auth middleware sets req.user

    // Validate inputs
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate are required' 
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ 
        error: 'startDate must be before endDate' 
      });
    }

    const schedulesToCreate = [];
    const currentDate = new Date(start);

    // Loop through each date in range
    while (currentDate <= end) {
      const dateToCheck = new Date(currentDate);
      dateToCheck.setHours(0, 0, 0, 0); // Normalize to start of day

      // Check if schedule already exists for this date
      const existingSchedule = await mealScheduleCollection.findOne({
        date: dateToCheck
      });

      if (!existingSchedule) {
        // Create new schedule with auto-fill logic
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

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Insert all schedules
    if (schedulesToCreate.length > 0) {
      const result = await mealScheduleCollection.insertMany(schedulesToCreate);
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