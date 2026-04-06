"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userIdParamsSchema = exports.z = void 0;
const validation_1 = require("../shared/validation");
Object.defineProperty(exports, "z", { enumerable: true, get: function () { return validation_1.z; } });
const userIdParamsSchema = validation_1.z.object({
    userId: validation_1.objectIdSchema
});
exports.userIdParamsSchema = userIdParamsSchema;
