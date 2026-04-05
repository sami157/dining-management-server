const {
  getMealDeadlineConfig,
  updateMealDeadlineConfig,
  validateMealDeadlineConfig
} = require('./meal-deadlines.service');

const getGlobalMealDeadlines = async (req, res) => {
  try {
    const mealDeadlines = await getMealDeadlineConfig();
    return res.status(200).json({ mealDeadlines });
  } catch (error) {
    console.error('Error fetching meal deadlines:', error);
    return res.status(500).json({ error: 'Failed to fetch meal deadlines' });
  }
};

const updateGlobalMealDeadlines = async (req, res) => {
  try {
    const validationError = validateMealDeadlineConfig(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const mealDeadlines = await updateMealDeadlineConfig(req.body, req.user?._id || null);

    return res.status(200).json({
      message: 'Meal deadlines updated successfully',
      mealDeadlines
    });
  } catch (error) {
    console.error('Error updating meal deadlines:', error);
    return res.status(500).json({ error: 'Failed to update meal deadlines' });
  }
};

module.exports = {
  getGlobalMealDeadlines,
  updateGlobalMealDeadlines
};
