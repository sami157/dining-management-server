"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const verifyFirebaseToken = require("../../middleware/verifyFirebaseToken");
const validateRequest = require("../../middleware/validateRequest");
const authorization_1 = require("../shared/authorization");
const meal_deadlines_controller_1 = require("./meal-deadlines.controller");
const meal_deadlines_validation_1 = require("./meal-deadlines.validation");
const router = express_1.default.Router();
router.get('/', verifyFirebaseToken(), meal_deadlines_controller_1.getGlobalMealDeadlines);
router.put('/', verifyFirebaseToken(authorization_1.ROLE_POLICIES.mealDeadlineManagement), validateRequest({ body: meal_deadlines_validation_1.mealDeadlinesBodySchema }), meal_deadlines_controller_1.updateGlobalMealDeadlines);
module.exports = router;
