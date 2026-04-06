"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const verifyFirebaseToken = require("../../middleware/verifyFirebaseToken");
const validateRequest = require("../../middleware/validateRequest");
const authorization_1 = require("../shared/authorization");
const meal_schedules_controller_1 = require("./meal-schedules.controller");
const meal_schedules_validation_1 = require("./meal-schedules.validation");
const router = express_1.default.Router();
router.post('/schedules/generate', verifyFirebaseToken(authorization_1.ROLE_POLICIES.mealScheduleManagement), validateRequest({ body: meal_schedules_validation_1.generateSchedulesBodySchema }), meal_schedules_controller_1.generateSchedules);
router.get('/schedules', verifyFirebaseToken(), validateRequest({ query: meal_schedules_validation_1.schedulesRangeQuerySchema }), meal_schedules_controller_1.getSchedules);
router.put('/schedules/:scheduleId', verifyFirebaseToken(authorization_1.ROLE_POLICIES.mealScheduleManagement), validateRequest({ params: meal_schedules_validation_1.scheduleIdParamsSchema, body: meal_schedules_validation_1.updateScheduleBodySchema }), meal_schedules_controller_1.updateSchedule);
router.delete('/schedules/:scheduleId', verifyFirebaseToken(authorization_1.ROLE_POLICIES.mealScheduleManagement), validateRequest({ params: meal_schedules_validation_1.scheduleIdParamsSchema }), meal_schedules_controller_1.deleteSchedule);
router.get('/registrations', validateRequest({ query: meal_schedules_validation_1.schedulesRangeQuerySchema }), meal_schedules_controller_1.getAllRegistrations);
module.exports = router;
