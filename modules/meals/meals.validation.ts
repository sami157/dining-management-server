import {
  z,
  dateOnlySchema,
  emailSchema,
  mealTypeSchema,
  monthSchema,
  objectIdSchema
} from '../shared/validation';

const availableMealsQuerySchema = z.object({
  month: monthSchema.optional(),
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.optional()
}).superRefine((data, ctx) => {
  const hasMonth = Boolean(data.month);
  const hasRange = Boolean(data.startDate && data.endDate);

  if (!hasMonth && !hasRange) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either month OR both startDate and endDate are required',
      path: ['month']
    });
  }

  if (hasMonth && (data.startDate || data.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Use either month or a startDate/endDate range, not both',
      path: ['month']
    });
  }
});

const registerMealBodySchema = z.object({
  date: dateOnlySchema,
  mealType: mealTypeSchema,
  userId: objectIdSchema.optional(),
  numberOfMeals: z.number().positive().optional()
});

const registrationIdParamsSchema = z.object({
  registrationId: objectIdSchema
});

const updateMealRegistrationBodySchema = z.object({
  numberOfMeals: z.number().positive('numberOfMeals must be a positive number')
});

const totalMealsParamsSchema = z.object({
  email: emailSchema
});

const totalMealsQuerySchema = z.object({
  month: monthSchema.optional()
});

const bulkRegisterMealsQuerySchema = z.object({
  month: monthSchema
});

export {
  availableMealsQuerySchema,
  registerMealBodySchema,
  registrationIdParamsSchema,
  updateMealRegistrationBodySchema,
  totalMealsParamsSchema,
  totalMealsQuerySchema,
  bulkRegisterMealsQuerySchema
};
