import { z, objectIdSchema } from '../shared/validation';

const userIdParamsSchema = z.object({
  userId: objectIdSchema
});

export {
  z,
  userIdParamsSchema
};
