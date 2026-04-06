import type { Request, Response } from 'express';
const { asyncHandler } = require('../shared/controller.utils');
import { getRunningMealRateSummary } from './stats.service';
import type { RunningMealRateQuery } from './stats.validation';

const getRunningMealRate = asyncHandler(async (req: Request, res: Response) => {
  const result = await getRunningMealRateSummary(req.query as RunningMealRateQuery);
  return res.status(200).json(result);
});

export {
  getRunningMealRate
};
