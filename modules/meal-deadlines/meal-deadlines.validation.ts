import { z, mealTypeSchema } from '../shared/validation';

const singleMealDeadlineSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  dayOffset: z.number().int()
});

const mealDeadlinesBodySchema = z.object({
  morning: singleMealDeadlineSchema,
  evening: singleMealDeadlineSchema,
  night: singleMealDeadlineSchema
});

export {
  mealTypeSchema,
  singleMealDeadlineSchema,
  mealDeadlinesBodySchema
};
