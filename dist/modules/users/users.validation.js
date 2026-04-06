"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailParamsSchema = exports.listUsersQuerySchema = exports.updateMosqueFeeBodySchema = exports.updateFixedDepositBodySchema = exports.updateUserRoleBodySchema = exports.userIdParamsSchema = exports.updateUserProfileBodySchema = exports.createUserBodySchema = void 0;
const validation_1 = require("../shared/validation");
const createUserBodySchema = validation_1.z.object({
    name: validation_1.z.string().min(1, 'name is required'),
    building: validation_1.z.string().trim().optional(),
    room: validation_1.z.string().trim().optional(),
    email: validation_1.emailSchema.optional(),
    mobile: validation_1.z.string().min(1, 'mobile is required'),
    designation: validation_1.z.string().trim().optional(),
    bank: validation_1.z.any().optional(),
    department: validation_1.z.string().trim().optional()
});
exports.createUserBodySchema = createUserBodySchema;
const updateUserProfileBodySchema = validation_1.z.object({
    name: validation_1.z.string().min(1).optional(),
    building: validation_1.z.string().trim().optional(),
    room: validation_1.z.string().trim().optional(),
    mobile: validation_1.z.string().min(1).optional(),
    designation: validation_1.z.string().trim().optional(),
    department: validation_1.z.string().trim().optional()
}).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one profile field is required'
});
exports.updateUserProfileBodySchema = updateUserProfileBodySchema;
const userIdParamsSchema = validation_1.z.object({
    userId: validation_1.objectIdSchema
});
exports.userIdParamsSchema = userIdParamsSchema;
const updateUserRoleBodySchema = validation_1.z.object({
    role: validation_1.userRoleSchema
});
exports.updateUserRoleBodySchema = updateUserRoleBodySchema;
const updateFixedDepositBodySchema = validation_1.z.object({
    fixedDeposit: validation_1.nonNegativeNumberSchema
});
exports.updateFixedDepositBodySchema = updateFixedDepositBodySchema;
const updateMosqueFeeBodySchema = validation_1.z.object({
    mosqueFee: validation_1.nonNegativeNumberSchema
});
exports.updateMosqueFeeBodySchema = updateMosqueFeeBodySchema;
const listUsersQuerySchema = validation_1.z.object({
    role: validation_1.userRoleSchema.optional(),
    department: validation_1.z.string().trim().optional()
});
exports.listUsersQuerySchema = listUsersQuerySchema;
const emailParamsSchema = validation_1.z.object({
    email: validation_1.emailSchema
});
exports.emailParamsSchema = emailParamsSchema;
