import type { Request, Response } from 'express';
const {
  getMealDeadlineConfig,
  updateMealDeadlineConfig
} = require('./meal-deadlines.service');
const { asyncHandler } = require('../shared/controller.utils');

const getGlobalMealDeadlines = asyncHandler(async (req: Request, res: Response) => {
  const mealDeadlines = await getMealDeadlineConfig();
  return res.status(200).json({ mealDeadlines });
});

const updateGlobalMealDeadlines = asyncHandler(async (req: Request, res: Response) => {
  const mealDeadlines = await updateMealDeadlineConfig(req.body, req.user?._id || null);

  return res.status(200).json({
    message: 'Meal deadlines updated successfully',
    mealDeadlines
  });
});

export {
  getGlobalMealDeadlines,
  updateGlobalMealDeadlines
};
