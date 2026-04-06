import {
  z,
  dateOnlySchema,
  monthSchema,
  objectIdSchema,
  positiveNumberSchema
} from '../shared/validation';

const addDepositBodySchema = z.object({
  userId: objectIdSchema,
  amount: positiveNumberSchema,
  month: monthSchema,
  depositDate: dateOnlySchema.optional(),
  notes: z.string().optional()
});

const depositsQuerySchema = z.object({
  month: monthSchema.optional(),
  userId: objectIdSchema.optional()
});

const currentUserDepositQuerySchema = z.object({
  month: monthSchema
});

const depositIdParamsSchema = z.object({
  depositId: objectIdSchema
});

const updateDepositBodySchema = z.object({
  amount: positiveNumberSchema.optional(),
  month: monthSchema.optional(),
  depositDate: dateOnlySchema.optional(),
  notes: z.string().optional()
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one deposit field is required'
});

export {
  addDepositBodySchema,
  depositsQuerySchema,
  currentUserDepositQuerySchema,
  depositIdParamsSchema,
  updateDepositBodySchema
};
