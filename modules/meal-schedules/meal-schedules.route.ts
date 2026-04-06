// @ts-nocheck
const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const {
  generateSchedules,
  getSchedules,
  updateSchedule,
  deleteSchedule,
  getAllRegistrations
} = require('./meal-schedules.controller');

const router = express.Router();

router.post('/schedules/generate', verifyFirebaseToken(['admin', 'super_admin']), generateSchedules);
router.get('/schedules', verifyFirebaseToken(), getSchedules);
router.put('/schedules/:scheduleId', verifyFirebaseToken(['admin', 'super_admin']), updateSchedule);
router.delete('/schedules/:scheduleId', verifyFirebaseToken(['admin', 'super_admin']), deleteSchedule);
router.get('/registrations', getAllRegistrations);

module.exports = router;

