const express = require('express');
const { generateSchedules, getSchedules, updateSchedule, bulkUpdateSchedules, getAllRegistrations } = require('./managers.controller');
const router = express.Router();

// Create leal schedules
router.post('/schedules/generate', generateSchedules);

// Get meal schedules
router.get('/schedules', getSchedules);

// Update a single schedule
router.put('/schedules/:scheduleId', updateSchedule);

// Get all registrations for a date range
router.get('/registrations', getAllRegistrations);

module.exports = router;