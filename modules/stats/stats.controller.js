const { getCollections } = require('../../config/connectMongodb');
const {
  calculateWeightedMeals,
  getUtcMonthRange,
  toDateKey,
  validateMonth,
} = require('../finance/accounting.utils');

const getRunningMealRate = async (req, res) => {
  try {
    const { month, date } = req.query;

    if (!month || !validateMonth(month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
    }

    const { endDate: monthEndDate } = getUtcMonthRange(month);

    let targetDate = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'date must be a valid date string (e.g., 2025-01-15)' });
    }

    const targetMonth = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}`;
    if (date && targetMonth !== month) {
      return res.status(400).json({ error: 'date must be within the requested month' });
    }

    if (!date && targetDate > monthEndDate) {
      targetDate = monthEndDate;
    }

    const endDate = new Date(targetDate);
    endDate.setUTCHours(23, 59, 59, 999);

    const collections = await getCollections();
    const { expenses } = collections;

    const [mealTotals, monthExpenses] = await Promise.all([
      calculateWeightedMeals({ collections, month, endDate }),
      expenses.find({ date: { $gte: getUtcMonthRange(month).startDate, $lte: endDate } }).toArray(),
    ]);

    const totalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const mealRate = mealTotals.totalMealsServed > 0
      ? parseFloat((totalExpenses / mealTotals.totalMealsServed).toFixed(2))
      : 0;

    return res.status(200).json({
      month,
      asOf: toDateKey(targetDate),
      totalMealsServed: mealTotals.totalMealsServed,
      totalExpenses,
      mealRate
    });

  } catch (error) {
    console.error('Error calculating running meal rate:', error);
    return res.status(500).json({ error: 'Failed to calculate running meal rate' });
  }
};

module.exports = {
  getRunningMealRate
};
