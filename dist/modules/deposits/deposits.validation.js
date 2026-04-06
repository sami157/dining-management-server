"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDepositBodySchema = exports.depositIdParamsSchema = exports.currentUserDepositQuerySchema = exports.depositsQuerySchema = exports.addDepositBodySchema = void 0;
const validation_1 = require("../shared/validation");
const addDepositBodySchema = validation_1.z.object({
    userId: validation_1.objectIdSchema,
    amount: validation_1.positiveNumberSchema,
    month: validation_1.monthSchema,
    depositDate: validation_1.dateOnlySchema.optional(),
    notes: validation_1.z.string().optional()
});
exports.addDepositBodySchema = addDepositBodySchema;
const depositsQuerySchema = validation_1.z.object({
    month: validation_1.monthSchema.optional(),
    userId: validation_1.objectIdSchema.optional()
});
exports.depositsQuerySchema = depositsQuerySchema;
const currentUserDepositQuerySchema = validation_1.z.object({
    month: validation_1.monthSchema
});
exports.currentUserDepositQuerySchema = currentUserDepositQuerySchema;
const depositIdParamsSchema = validation_1.z.object({
    depositId: validation_1.objectIdSchema
});
exports.depositIdParamsSchema = depositIdParamsSchema;
const updateDepositBodySchema = validation_1.z.object({
    amount: validation_1.positiveNumberSchema.optional(),
    month: validation_1.monthSchema.optional(),
    depositDate: validation_1.dateOnlySchema.optional(),
    notes: validation_1.z.string().optional()
}).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one deposit field is required'
});
exports.updateDepositBodySchema = updateDepositBodySchema;
