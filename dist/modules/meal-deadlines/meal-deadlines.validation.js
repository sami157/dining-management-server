"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealDeadlinesBodySchema = exports.singleMealDeadlineSchema = exports.mealTypeSchema = void 0;
const validation_1 = require("../shared/validation");
Object.defineProperty(exports, "mealTypeSchema", { enumerable: true, get: function () { return validation_1.mealTypeSchema; } });
const singleMealDeadlineSchema = validation_1.z.object({
    hour: validation_1.z.number().int().min(0).max(23),
    minute: validation_1.z.number().int().min(0).max(59),
    dayOffset: validation_1.z.number().int()
});
exports.singleMealDeadlineSchema = singleMealDeadlineSchema;
const mealDeadlinesBodySchema = validation_1.z.object({
    morning: singleMealDeadlineSchema,
    evening: singleMealDeadlineSchema,
    night: singleMealDeadlineSchema
});
exports.mealDeadlinesBodySchema = mealDeadlinesBodySchema;
