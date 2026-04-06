const { getRunningMealRateSummary } = require('./stats.service');
const { asyncHandler } = require('../shared/controller.utils');

const getRunningMealRate = asyncHandler(async (req, res) => {
  const result = await getRunningMealRateSummary(req.query);
  return res.status(200).json(result);
});

module.exports = {
  getRunningMealRate
};
