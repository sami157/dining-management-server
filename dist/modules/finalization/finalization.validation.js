"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentUserFinalizationQuerySchema = exports.monthParamsSchema = exports.finalizeMonthBodySchema = exports.z = void 0;
const validation_1 = require("../shared/validation");
Object.defineProperty(exports, "z", { enumerable: true, get: function () { return validation_1.z; } });
const finalizeMonthBodySchema = validation_1.z.object({
    month: validation_1.monthSchema
});
exports.finalizeMonthBodySchema = finalizeMonthBodySchema;
const monthParamsSchema = validation_1.z.object({
    month: validation_1.monthSchema
});
exports.monthParamsSchema = monthParamsSchema;
const currentUserFinalizationQuerySchema = validation_1.z.object({
    month: validation_1.monthSchema
});
exports.currentUserFinalizationQuerySchema = currentUserFinalizationQuerySchema;
