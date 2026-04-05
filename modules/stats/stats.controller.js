const { getRunningMealRateSummary } = require('./stats.service');
const { handleControllerError } = require('../finance/finance.utils');

const getRunningMealRate = async (req, res) => {
  try {
    const result = await getRunningMealRateSummary(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Error calculating running meal rate:');
  }
};

module.exports = {
  getRunningMealRate
};
