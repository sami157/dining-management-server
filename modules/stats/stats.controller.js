const { getCollections } = require('../../config/connectMongodb');
const { DINING_IDS, DEFAULT_DINING_ID, normalizeDiningId } = require('../../config/dining');

const getDiningQuery = (diningId = DEFAULT_DINING_ID) => {
  const normalizedDiningId = normalizeDiningId(diningId);

  if (normalizedDiningId === DEFAULT_DINING_ID) {
    return { $or: [{ diningId: DEFAULT_DINING_ID }, { diningId: { $exists: false } }] };
  }

  return { diningId: normalizedDiningId };
};

const getRunningMealRate = async (req, res) => {
  try {
    const { month, date } = req.query;
    const diningId = normalizeDiningId(req.query?.diningId);

    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!month || !monthRegex.test(month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
    }

    if (!DINING_IDS.includes(diningId)) {
      return res.status(400).json({ error: `diningId must be one of: ${DINING_IDS.join(', ')}` });
    }

    const targetDate = date ? new Date(date) : new Date();
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'date must be a valid date string (e.g., 2025-01-15)' });
    }

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const { mealRegistrations, mealSchedules, expenses } = await getCollections();

    const [allRegistrations, allSchedules, monthExpenses] = await Promise.all([
      mealRegistrations.find({ date: { $gte: startDate, $lte: endDate }, ...getDiningQuery(diningId) }).toArray(),
      mealSchedules.find({ date: { $gte: startDate, $lte: endDate } }).toArray(),
      expenses.find({ date: { $gte: startDate, $lte: endDate }, ...getDiningQuery(diningId) }).toArray(),
    ]);

    const scheduleMap = {};
    for (const schedule of allSchedules) {
      scheduleMap[schedule.date.toISOString()] = schedule;
    }

    let totalMealsServed = 0;
    for (const reg of allRegistrations) {
      const schedule = scheduleMap[reg.date.toISOString()];
      if (schedule) {
        const registrationDiningId = normalizeDiningId(reg.diningId);
        const meal = schedule.availableMeals.find(
          m => m.mealType === reg.mealType && normalizeDiningId(m.diningId) === registrationDiningId
        );
        const weight = meal?.weight || 1;
        const numberOfMeals = reg.numberOfMeals || 1;
        totalMealsServed += numberOfMeals * weight;
      }
    }

    const totalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const mealRate = totalMealsServed > 0
      ? parseFloat((totalExpenses / totalMealsServed).toFixed(2))
      : 0;

    return res.status(200).json({
      month,
      diningId,
      asOf: targetDate.toISOString().split('T')[0],
      totalMealsServed,
      totalExpenses,
      mealRate: parseFloat(mealRate.toFixed(2))
    });

  } catch (error) {
    console.error('Error calculating running meal rate:', error);
    return res.status(500).json({ error: 'Failed to calculate running meal rate' });
  }
};

module.exports = {
  getRunningMealRate
};
