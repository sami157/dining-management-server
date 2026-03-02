const express = require('express');
const { generateSchedules, getSchedules, updateSchedule, bulkUpdateSchedules, getAllRegistrations, deleteSchedule } = require('./managers.controller');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const router = express.Router();

// Create meal schedules
router.post('/schedules/generate', verifyFirebaseToken(), generateSchedules);

// Get meal schedules
router.get('/schedules', verifyFirebaseToken(), getSchedules);

// Update a single schedule
router.put('/schedules/:scheduleId', verifyFirebaseToken(), updateSchedule);

// Delete a single schedule
router.delete('/schedules/:scheduleId', verifyFirebaseToken(), deleteSchedule);

// Get all registrations for a date range
router.get('/registrations', getAllRegistrations);

module.exports = router;