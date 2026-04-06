import { z } from 'zod';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateString = (value: string) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const runningMealRateQuerySchema = z.object({
  month: z
    .string()
    .regex(monthPattern, 'month must be in YYYY-MM format (e.g., 2025-01)'),
  date: z
    .string()
    .regex(datePattern, 'date must be in YYYY-MM-DD format (e.g., 2025-01-15)')
    .refine(isValidDateString, 'date must be a valid date string (e.g., 2025-01-15)')
    .optional()
});

type RunningMealRateQuery = z.infer<typeof runningMealRateQuerySchema>;

export {
  runningMealRateQuerySchema,
  type RunningMealRateQuery
};
