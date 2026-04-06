"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runningMealRateQuerySchema = void 0;
const zod_1 = require("zod");
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const isValidDateString = (value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
};
const runningMealRateQuerySchema = zod_1.z.object({
    month: zod_1.z
        .string()
        .regex(monthPattern, 'month must be in YYYY-MM format (e.g., 2025-01)'),
    date: zod_1.z
        .string()
        .regex(datePattern, 'date must be in YYYY-MM-DD format (e.g., 2025-01-15)')
        .refine(isValidDateString, 'date must be a valid date string (e.g., 2025-01-15)')
        .optional()
});
exports.runningMealRateQuerySchema = runningMealRateQuerySchema;
