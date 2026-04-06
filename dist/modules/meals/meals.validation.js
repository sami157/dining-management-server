"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkRegisterMealsQuerySchema = exports.totalMealsQuerySchema = exports.totalMealsParamsSchema = exports.updateMealRegistrationBodySchema = exports.registrationIdParamsSchema = exports.registerMealBodySchema = exports.availableMealsQuerySchema = void 0;
const validation_1 = require("../shared/validation");
const availableMealsQuerySchema = validation_1.z.object({
    month: validation_1.monthSchema.optional(),
    startDate: validation_1.dateOnlySchema.optional(),
    endDate: validation_1.dateOnlySchema.optional()
}).superRefine((data, ctx) => {
    const hasMonth = Boolean(data.month);
    const hasRange = Boolean(data.startDate && data.endDate);
    if (!hasMonth && !hasRange) {
        ctx.addIssue({
            code: validation_1.z.ZodIssueCode.custom,
            message: 'Either month OR both startDate and endDate are required',
            path: ['month']
        });
    }
    if (hasMonth && (data.startDate || data.endDate)) {
        ctx.addIssue({
            code: validation_1.z.ZodIssueCode.custom,
            message: 'Use either month or a startDate/endDate range, not both',
            path: ['month']
        });
    }
});
exports.availableMealsQuerySchema = availableMealsQuerySchema;
const registerMealBodySchema = validation_1.z.object({
    date: validation_1.dateOnlySchema,
    mealType: validation_1.mealTypeSchema,
    userId: validation_1.objectIdSchema.optional(),
    numberOfMeals: validation_1.z.number().positive().optional()
});
exports.registerMealBodySchema = registerMealBodySchema;
const registrationIdParamsSchema = validation_1.z.object({
    registrationId: validation_1.objectIdSchema
});
exports.registrationIdParamsSchema = registrationIdParamsSchema;
const updateMealRegistrationBodySchema = validation_1.z.object({
    numberOfMeals: validation_1.z.number().positive('numberOfMeals must be a positive number')
});
exports.updateMealRegistrationBodySchema = updateMealRegistrationBodySchema;
const totalMealsParamsSchema = validation_1.z.object({
    email: validation_1.emailSchema
});
exports.totalMealsParamsSchema = totalMealsParamsSchema;
const totalMealsQuerySchema = validation_1.z.object({
    month: validation_1.monthSchema.optional()
});
exports.totalMealsQuerySchema = totalMealsQuerySchema;
const bulkRegisterMealsQuerySchema = validation_1.z.object({
    month: validation_1.monthSchema
});
exports.bulkRegisterMealsQuerySchema = bulkRegisterMealsQuerySchema;
