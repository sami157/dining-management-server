import express from 'express';
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const validateRequest = require('../../middleware/validateRequest');
import { getRunningMealRate } from './stats.controller';
import { runningMealRateQuerySchema } from './stats.validation';

const router = express.Router();

router.get(
  '/meal-rate',
  verifyFirebaseToken(),
  validateRequest({ query: runningMealRateQuerySchema }),
  getRunningMealRate
);

export = router;
