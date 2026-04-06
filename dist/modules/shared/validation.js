"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealTypeSchema = exports.userRoleSchema = exports.nonNegativeNumberSchema = exports.positiveNumberSchema = exports.emailSchema = exports.dateOnlySchema = exports.monthSchema = exports.objectIdSchema = exports.mealTypes = exports.userRoles = exports.z = void 0;
const zod_1 = require("zod");
Object.defineProperty(exports, "z", { enumerable: true, get: function () { return zod_1.z; } });
const userRoles = ['admin', 'manager', 'member', 'moderator', 'staff', 'super_admin'];
exports.userRoles = userRoles;
const mealTypes = ['morning', 'evening', 'night'];
exports.mealTypes = mealTypes;
const objectIdSchema = zod_1.z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');
exports.objectIdSchema = objectIdSchema;
const monthSchema = zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be in YYYY-MM format (e.g., 2025-01)');
exports.monthSchema = monthSchema;
const dateOnlySchema = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format (e.g., 2025-01-15)')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'date must be a valid date string (e.g., 2025-01-15)');
exports.dateOnlySchema = dateOnlySchema;
const emailSchema = zod_1.z.string().email('Invalid email address');
exports.emailSchema = emailSchema;
const positiveNumberSchema = zod_1.z.number().positive('Must be a positive number');
exports.positiveNumberSchema = positiveNumberSchema;
const nonNegativeNumberSchema = zod_1.z.number().min(0, 'Must be at least 0');
exports.nonNegativeNumberSchema = nonNegativeNumberSchema;
const userRoleSchema = zod_1.z.enum(userRoles);
exports.userRoleSchema = userRoleSchema;
const mealTypeSchema = zod_1.z.enum(mealTypes);
exports.mealTypeSchema = mealTypeSchema;
