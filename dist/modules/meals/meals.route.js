"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const verifyFirebaseToken = require("../../middleware/verifyFirebaseToken");
const validateRequest = require("../../middleware/validateRequest");
const meals_controller_1 = require("./meals.controller");
const meals_validation_1 = require("./meals.validation");
const router = express_1.default.Router();
router.get('/available', verifyFirebaseToken(), validateRequest({ query: meals_validation_1.availableMealsQuerySchema }), meals_controller_1.getAvailableMeals);
router.post('/register', verifyFirebaseToken(), validateRequest({ body: meals_validation_1.registerMealBodySchema }), meals_controller_1.registerMeal);
router.post('/bulk-register', verifyFirebaseToken(), validateRequest({ query: meals_validation_1.bulkRegisterMealsQuerySchema }), meals_controller_1.bulkToggleMealsForUser);
router.patch('/register/:registrationId', verifyFirebaseToken(), validateRequest({ params: meals_validation_1.registrationIdParamsSchema, body: meals_validation_1.updateMealRegistrationBodySchema }), meals_controller_1.updateMealRegistration);
router.delete('/register/cancel/:registrationId', verifyFirebaseToken(), validateRequest({ params: meals_validation_1.registrationIdParamsSchema }), meals_controller_1.cancelMealRegistration);
router.get('/total/:email', verifyFirebaseToken(), validateRequest({ params: meals_validation_1.totalMealsParamsSchema, query: meals_validation_1.totalMealsQuerySchema }), meals_controller_1.getTotalMealsForUser);
module.exports = router;
