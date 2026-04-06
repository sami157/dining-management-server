"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateExpenseBodySchema = exports.expenseIdParamsSchema = exports.expensesQuerySchema = exports.expenseBodyBaseSchema = void 0;
const validation_1 = require("../shared/validation");
const expenseBodyBaseSchema = validation_1.z.object({
    date: validation_1.dateOnlySchema,
    category: validation_1.z.string().min(1, 'category is required'),
    amount: validation_1.positiveNumberSchema,
    description: validation_1.z.string().optional(),
    person: validation_1.z.string().optional()
});
exports.expenseBodyBaseSchema = expenseBodyBaseSchema;
const expensesQuerySchema = validation_1.z.object({
    startDate: validation_1.dateOnlySchema.optional(),
    endDate: validation_1.dateOnlySchema.optional(),
    category: validation_1.z.string().trim().optional()
}).superRefine((data, ctx) => {
    if ((data.startDate && !data.endDate) || (!data.startDate && data.endDate)) {
        ctx.addIssue({
            code: validation_1.z.ZodIssueCode.custom,
            message: 'startDate and endDate must be provided together',
            path: ['startDate']
        });
    }
});
exports.expensesQuerySchema = expensesQuerySchema;
const expenseIdParamsSchema = validation_1.z.object({
    expenseId: validation_1.objectIdSchema
});
exports.expenseIdParamsSchema = expenseIdParamsSchema;
const updateExpenseBodySchema = expenseBodyBaseSchema.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'At least one expense field is required'
});
exports.updateExpenseBodySchema = updateExpenseBodySchema;
