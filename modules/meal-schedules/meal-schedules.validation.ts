import {
  z,
  dateOnlySchema,
  mealTypeSchema,
  objectIdSchema
} from '../shared/validation';

const mealConfigSchema = z.object({
  mealType: mealTypeSchema,
  isAvailable: z.boolean(),
  customDeadline: z.string().datetime().nullable().optional(),
  weight: z.number().min(0).optional(),
  menu: z.string().optional()
});

const generateSchedulesBodySchema = z.object({
  startDate: dateOnlySchema,
  endDate: dateOnlySchema
});

const schedulesRangeQuerySchema = z.object({
  startDate: dateOnlySchema,
  endDate: dateOnlySchema
});

const mealSheetQuerySchema = z.object({
  date: dateOnlySchema
});

const scheduleIdParamsSchema = z.object({
  scheduleId: objectIdSchema
});

const updateScheduleBodySchema = z.object({
  isHoliday: z.boolean().optional(),
  availableMeals: z.array(mealConfigSchema).optional()
}).refine((data) => data.isHoliday !== undefined || data.availableMeals !== undefined, {
  message: 'At least one schedule field is required'
});

export {
  generateSchedulesBodySchema,
  schedulesRangeQuerySchema,
  mealSheetQuerySchema,
  scheduleIdParamsSchema,
  updateScheduleBodySchema
};
