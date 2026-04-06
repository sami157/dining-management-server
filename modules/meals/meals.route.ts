import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import {
  bulkToggleMealsForUser,
  cancelMealRegistration,
  getAvailableMeals,
  getTotalMealsForUser,
  registerMeal,
  updateMealRegistration
} from './meals.controller';
import {
  availableMealsQuerySchema,
  bulkRegisterMealsQuerySchema,
  registerMealBodySchema,
  registrationIdParamsSchema,
  totalMealsParamsSchema,
  totalMealsQuerySchema,
  updateMealRegistrationBodySchema
} from './meals.validation';

const router = express.Router();

router.get('/available', verifyFirebaseToken(), validateRequest({ query: availableMealsQuerySchema }), getAvailableMeals);
router.post('/register', verifyFirebaseToken(), validateRequest({ body: registerMealBodySchema }), registerMeal);
router.post('/bulk-register', verifyFirebaseToken(), validateRequest({ query: bulkRegisterMealsQuerySchema }), bulkToggleMealsForUser);
router.patch(
  '/register/:registrationId',
  verifyFirebaseToken(),
  validateRequest({ params: registrationIdParamsSchema, body: updateMealRegistrationBodySchema }),
  updateMealRegistration
);
router.delete(
  '/register/cancel/:registrationId',
  verifyFirebaseToken(),
  validateRequest({ params: registrationIdParamsSchema }),
  cancelMealRegistration
);
router.get(
  '/total/:email',
  verifyFirebaseToken(),
  validateRequest({ params: totalMealsParamsSchema, query: totalMealsQuerySchema }),
  getTotalMealsForUser
);

export = router;
