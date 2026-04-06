"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateScheduleBodySchema = exports.scheduleIdParamsSchema = exports.schedulesRangeQuerySchema = exports.generateSchedulesBodySchema = void 0;
const validation_1 = require("../shared/validation");
const mealConfigSchema = validation_1.z.object({
    mealType: validation_1.mealTypeSchema,
    isAvailable: validation_1.z.boolean(),
    customDeadline: validation_1.z.string().datetime().nullable().optional(),
    weight: validation_1.z.number().min(0).optional(),
    menu: validation_1.z.string().optional()
});
const generateSchedulesBodySchema = validation_1.z.object({
    startDate: validation_1.dateOnlySchema,
    endDate: validation_1.dateOnlySchema
});
exports.generateSchedulesBodySchema = generateSchedulesBodySchema;
const schedulesRangeQuerySchema = validation_1.z.object({
    startDate: validation_1.dateOnlySchema,
    endDate: validation_1.dateOnlySchema
});
exports.schedulesRangeQuerySchema = schedulesRangeQuerySchema;
const scheduleIdParamsSchema = validation_1.z.object({
    scheduleId: validation_1.objectIdSchema
});
exports.scheduleIdParamsSchema = scheduleIdParamsSchema;
const updateScheduleBodySchema = validation_1.z.object({
    isHoliday: validation_1.z.boolean().optional(),
    availableMeals: validation_1.z.array(mealConfigSchema).optional()
}).refine((data) => data.isHoliday !== undefined || data.availableMeals !== undefined, {
    message: 'At least one schedule field is required'
});
exports.updateScheduleBodySchema = updateScheduleBodySchema;
