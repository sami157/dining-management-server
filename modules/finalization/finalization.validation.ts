import { z, monthSchema } from '../shared/validation';

const finalizeMonthBodySchema = z.object({
  month: monthSchema
});

const monthParamsSchema = z.object({
  month: monthSchema
});

const currentUserFinalizationQuerySchema = z.object({
  month: monthSchema
});

export {
  z,
  finalizeMonthBodySchema,
  monthParamsSchema,
  currentUserFinalizationQuerySchema
};
