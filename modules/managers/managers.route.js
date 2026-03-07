const express = require('express');
const { generateSchedules, getSchedules, updateSchedule, bulkUpdateSchedules, getAllRegistrations, deleteSchedule } = require('./managers.controller');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const router = express.Router();

// Create meal schedules
router.post('/schedules/generate', verifyFirebaseToken(true), generateSchedules);

// Get meal schedules
router.get('/schedules', verifyFirebaseToken(), getSchedules);

// Update a single schedule
router.put('/schedules/:scheduleId', verifyFirebaseToken(true), updateSchedule);

// Delete a single schedule
router.delete('/schedules/:scheduleId', verifyFirebaseToken(true), deleteSchedule);

// Get all registrations for a date range
router.get('/registrations', getAllRegistrations);

module.exports = router;true