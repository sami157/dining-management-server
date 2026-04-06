import {
  z,
  emailSchema,
  nonNegativeNumberSchema,
  objectIdSchema,
  userRoleSchema
} from '../shared/validation';

const createUserBodySchema = z.object({
  name: z.string().min(1, 'name is required'),
  building: z.string().trim().optional(),
  room: z.string().trim().optional(),
  email: emailSchema.optional(),
  mobile: z.string().min(1, 'mobile is required'),
  designation: z.string().trim().optional(),
  bank: z.any().optional(),
  department: z.string().trim().optional(),
  mealDefault: z.boolean().optional()
});

const updateUserProfileBodySchema = z.object({
  name: z.string().min(1).optional(),
  building: z.string().trim().optional(),
  room: z.string().trim().optional(),
  mobile: z.string().min(1).optional(),
  designation: z.string().trim().optional(),
  department: z.string().trim().optional(),
  mealDefault: z.boolean().optional()
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one profile field is required'
});

const userIdParamsSchema = z.object({
  userId: objectIdSchema
});

const updateUserRoleBodySchema = z.object({
  role: userRoleSchema
});

const updateFixedDepositBodySchema = z.object({
  fixedDeposit: nonNegativeNumberSchema
});

const updateMosqueFeeBodySchema = z.object({
  mosqueFee: nonNegativeNumberSchema
});

const listUsersQuerySchema = z.object({
  role: userRoleSchema.optional(),
  department: z.string().trim().optional()
});

const emailParamsSchema = z.object({
  email: emailSchema
});

export {
  createUserBodySchema,
  updateUserProfileBodySchema,
  userIdParamsSchema,
  updateUserRoleBodySchema,
  updateFixedDepositBodySchema,
  updateMosqueFeeBodySchema,
  listUsersQuerySchema,
  emailParamsSchema
};
