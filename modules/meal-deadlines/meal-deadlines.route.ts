import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import {
  getGlobalMealDeadlines,
  updateGlobalMealDeadlines
} from './meal-deadlines.controller';
import { mealDeadlinesBodySchema } from './meal-deadlines.validation';

const router = express.Router();

router.get('/', verifyFirebaseToken(), getGlobalMealDeadlines);
router.put('/', verifyFirebaseToken(['admin', 'super_admin']), validateRequest({ body: mealDeadlinesBodySchema }), updateGlobalMealDeadlines);

export = router;
