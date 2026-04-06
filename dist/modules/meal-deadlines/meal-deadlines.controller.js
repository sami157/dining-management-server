"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGlobalMealDeadlines = exports.getGlobalMealDeadlines = void 0;
const { getMealDeadlineConfig, updateMealDeadlineConfig } = require('./meal-deadlines.service');
const { asyncHandler } = require('../shared/controller.utils');
const getGlobalMealDeadlines = asyncHandler(async (req, res) => {
    const mealDeadlines = await getMealDeadlineConfig();
    return res.status(200).json({ mealDeadlines });
});
exports.getGlobalMealDeadlines = getGlobalMealDeadlines;
const updateGlobalMealDeadlines = asyncHandler(async (req, res) => {
    const mealDeadlines = await updateMealDeadlineConfig(req.body, req.user?._id || null);
    return res.status(200).json({
        message: 'Meal deadlines updated successfully',
        mealDeadlines
    });
});
exports.updateGlobalMealDeadlines = updateGlobalMealDeadlines;
