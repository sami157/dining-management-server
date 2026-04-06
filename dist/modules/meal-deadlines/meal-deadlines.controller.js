"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const { getMealDeadlineConfig, updateMealDeadlineConfig, validateMealDeadlineConfig } = require('./meal-deadlines.service');
const { createHttpError } = require('../../middleware/errorHandler');
const { asyncHandler } = require('../shared/controller.utils');
const getGlobalMealDeadlines = asyncHandler(async (req, res) => {
    const mealDeadlines = await getMealDeadlineConfig();
    return res.status(200).json({ mealDeadlines });
});
const updateGlobalMealDeadlines = asyncHandler(async (req, res) => {
    const validationError = validateMealDeadlineConfig(req.body);
    if (validationError) {
        throw createHttpError(400, validationError);
    }
    const mealDeadlines = await updateMealDeadlineConfig(req.body, req.user?._id || null);
    return res.status(200).json({
        message: 'Meal deadlines updated successfully',
        mealDeadlines
    });
});
module.exports = {
    getGlobalMealDeadlines,
    updateGlobalMealDeadlines
};
