import {
  z,
  dateOnlySchema,
  objectIdSchema,
  positiveNumberSchema
} from '../shared/validation';

const expenseBodyBaseSchema = z.object({
  date: dateOnlySchema,
  category: z.string().min(1, 'category is required'),
  amount: positiveNumberSchema,
  description: z.string().optional(),
  person: z.string().optional()
});

const expensesQuerySchema = z.object({
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.optional(),
  category: z.string().trim().optional()
}).superRefine((data, ctx) => {
  if ((data.startDate && !data.endDate) || (!data.startDate && data.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startDate and endDate must be provided together',
      path: ['startDate']
    });
  }
});

const expenseIdParamsSchema = z.object({
  expenseId: objectIdSchema
});

const updateExpenseBodySchema = expenseBodyBaseSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one expense field is required'
});

export {
  expenseBodyBaseSchema,
  expensesQuerySchema,
  expenseIdParamsSchema,
  updateExpenseBodySchema
};
