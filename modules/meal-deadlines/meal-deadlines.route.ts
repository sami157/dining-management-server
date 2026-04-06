import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import { ROLE_POLICIES } from '../shared/authorization';
import {
  getGlobalMealDeadlines,
  updateGlobalMealDeadlines
} from './meal-deadlines.controller';
import { mealDeadlinesBodySchema } from './meal-deadlines.validation';

const router = express.Router();

router.get('/', verifyFirebaseToken(), getGlobalMealDeadlines);
router.put('/', verifyFirebaseToken(ROLE_POLICIES.mealDeadlineManagement), validateRequest({ body: mealDeadlinesBodySchema }), updateGlobalMealDeadlines);

export = router;
