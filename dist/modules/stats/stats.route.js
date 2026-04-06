"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const validateRequest = require('../../middleware/validateRequest');
const stats_controller_1 = require("./stats.controller");
const stats_validation_1 = require("./stats.validation");
const router = express_1.default.Router();
router.get('/meal-rate', verifyFirebaseToken(), validateRequest({ query: stats_validation_1.runningMealRateQuerySchema }), stats_controller_1.getRunningMealRate);
module.exports = router;
