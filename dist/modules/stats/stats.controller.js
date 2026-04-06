"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRunningMealRate = void 0;
const { asyncHandler } = require('../shared/controller.utils');
const stats_service_1 = require("./stats.service");
const getRunningMealRate = asyncHandler(async (req, res) => {
    const result = await (0, stats_service_1.getRunningMealRateSummary)(req.query);
    return res.status(200).json(result);
});
exports.getRunningMealRate = getRunningMealRate;
