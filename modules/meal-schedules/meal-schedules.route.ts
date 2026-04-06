import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import { ROLE_POLICIES } from '../shared/authorization';
import {
  deleteSchedule,
  generateSchedules,
  getAllRegistrations,
  getSchedules,
  updateSchedule
} from './meal-schedules.controller';
import {
  generateSchedulesBodySchema,
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
router.get('/registrations', validateRequest({ query: schedulesRangeQuerySchema }), getAllRegistrations);

export = router;
