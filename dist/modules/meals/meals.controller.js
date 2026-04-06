"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkToggleMealsForUser = exports.getTotalMealsForUser = exports.cancelMealRegistration = exports.updateMealRegistration = exports.registerMeal = exports.getAvailableMeals = void 0;
const { getAvailableMealsForUser, createMealRegistration, editMealRegistration, removeMealRegistration, getMealTotalsForUser, bulkRegisterMealsForUser } = require('./meals.service');
const { asyncHandler } = require('../shared/controller.utils');
const getAvailableMeals = asyncHandler(async (req, res) => {
    const result = await getAvailableMealsForUser(req.user?._id, req.query);
    return res.status(200).json(result);
});
exports.getAvailableMeals = getAvailableMeals;
const registerMeal = asyncHandler(async (req, res) => {
    const result = await createMealRegistration(req.body, req.user);
    return res.status(201).json(result);
});
exports.registerMeal = registerMeal;
const updateMealRegistration = asyncHandler(async (req, res) => {
    await editMealRegistration(req.params.registrationId, req.body.numberOfMeals, req.user);
    return res.status(200).json({ message: 'Registration updated successfully' });
});
exports.updateMealRegistration = updateMealRegistration;
const cancelMealRegistration = asyncHandler(async (req, res) => {
    await removeMealRegistration(req.params.registrationId, req.user);
    return res.status(200).json({ message: 'Meal registration cancelled successfully' });
});
exports.cancelMealRegistration = cancelMealRegistration;
const getTotalMealsForUser = asyncHandler(async (req, res) => {
    const result = await getMealTotalsForUser(req.params.email, req.query.month);
    return res.status(200).json(result);
});
exports.getTotalMealsForUser = getTotalMealsForUser;
const bulkToggleMealsForUser = asyncHandler(async (req, res) => {
    const result = await bulkRegisterMealsForUser(req.query.month, req.user?._id);
    return res.status(result.status).json({
        message: result.message,
        registeredCount: result.registeredCount
    });
});
exports.bulkToggleMealsForUser = bulkToggleMealsForUser;
