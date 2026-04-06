import { z } from 'zod';

const userRoles = ['admin', 'manager', 'member', 'moderator', 'staff', 'super_admin'] as const;
const mealTypes = ['morning', 'evening', 'night'] as const;

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be in YYYY-MM format (e.g., 2025-01)');
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format (e.g., 2025-01-15)')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'date must be a valid date string (e.g., 2025-01-15)');
const emailSchema = z.string().email('Invalid email address');
const positiveNumberSchema = z.number().positive('Must be a positive number');
const nonNegativeNumberSchema = z.number().min(0, 'Must be at least 0');
const userRoleSchema = z.enum(userRoles);
const mealTypeSchema = z.enum(mealTypes);

type UserRole = z.infer<typeof userRoleSchema>;
type MealType = z.infer<typeof mealTypeSchema>;

export {
  z,
  userRoles,
  mealTypes,
  objectIdSchema,
  monthSchema,
  dateOnlySchema,
  emailSchema,
  positiveNumberSchema,
  nonNegativeNumberSchema,
  userRoleSchema,
  mealTypeSchema,
  type UserRole,
  type MealType
};
