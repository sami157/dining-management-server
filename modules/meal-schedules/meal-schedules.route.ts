import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import { ROLE_POLICIES } from '../shared/authorization';
import {
  deleteSchedule,
  generateSchedules,
  getAllRegistrations,
  getMealSheet,
  getSchedules,
  updateSchedule
} from './meal-schedules.controller';
import {
  generateSchedulesBodySchema,
  mealSheetQuerySchema,
  scheduleIdParamsSchema,
  schedulesRangeQuerySchema,
  updateScheduleBodySchema
} from './meal-schedules.validation';

const router = express.Router();

router.post(
  '/schedules/generate',
  verifyFirebaseToken(ROLE_POLICIES.mealScheduleManagement),
  validateRequest({ body: generateSchedulesBodySchema }),
  generateSchedules
);
router.get('/schedules', verifyFirebaseToken(), validateRequest({ query: schedulesRangeQuerySchema }), getSchedules);
router.get('/meal-sheet', verifyFirebaseToken(), validateRequest({ query: mealSheetQuerySchema }), getMealSheet);
router.put(
  '/schedules/:scheduleId',
  verifyFirebaseToken(ROLE_POLICIES.mealScheduleManagement),
  validateRequest({ params: scheduleIdParamsSchema, body: updateScheduleBodySchema }),
  updateSchedule
);
router.delete(
  '/schedules/:scheduleId',
  verifyFirebaseToken(ROLE_POLICIES.mealScheduleManagement),
  validateRequest({ params: scheduleIdParamsSchema }),
  deleteSchedule
);
router.get('/registrations', verifyFirebaseToken(), validateRequest({ query: schedulesRangeQuerySchema }), getAllRegistrations);

export = router;
