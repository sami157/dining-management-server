import { z } from 'zod';
import { dateOnlySchema, monthSchema } from '../shared/validation';

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

const dashboardQuerySchema = z.object({
  month: monthSchema
});

const monthSummaryQuerySchema = z.object({
  month: monthSchema
});

const mealTrendQuerySchema = z.object({
  month: monthSchema
});

const expenseTrendQuerySchema = z.object({
  month: monthSchema
});

const topMembersQuerySchema = z.object({
  month: monthSchema,
  limit: z.coerce.number().int().min(1).max(50).optional()
});

const mealTypeBreakdownQuerySchema = z.object({
  month: monthSchema
});

const twoDaySheetSummaryQuerySchema = z.object({
  date: dateOnlySchema
});

const allTimeSummaryQuerySchema = z.object({});

type RunningMealRateQuery = z.infer<typeof runningMealRateQuerySchema>;
type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
type MonthSummaryQuery = z.infer<typeof monthSummaryQuerySchema>;
type MealTrendQuery = z.infer<typeof mealTrendQuerySchema>;
type ExpenseTrendQuery = z.infer<typeof expenseTrendQuerySchema>;
type TopMembersQuery = z.infer<typeof topMembersQuerySchema>;
type MealTypeBreakdownQuery = z.infer<typeof mealTypeBreakdownQuerySchema>;
type TwoDaySheetSummaryQuery = z.infer<typeof twoDaySheetSummaryQuerySchema>;
type AllTimeSummaryQuery = z.infer<typeof allTimeSummaryQuerySchema>;

export {
  runningMealRateQuerySchema,
  dashboardQuerySchema,
  monthSummaryQuerySchema,
  mealTrendQuerySchema,
  expenseTrendQuerySchema,
  topMembersQuerySchema,
  mealTypeBreakdownQuerySchema,
  twoDaySheetSummaryQuerySchema,
  allTimeSummaryQuerySchema,
  type RunningMealRateQuery,
  type DashboardQuery,
  type MonthSummaryQuery,
  type MealTrendQuery,
  type ExpenseTrendQuery,
  type TopMembersQuery,
  type MealTypeBreakdownQuery,
  type TwoDaySheetSummaryQuery,
  type AllTimeSummaryQuery
};
