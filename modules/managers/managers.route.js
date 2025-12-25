const express = require('express');
const { generateSchedules, getSchedules, updateSchedule, bulkUpdateSchedules } = require('./managers.controller');
const router = express.Router();

// Create leal schedules
router.post('/schedules/generate', generateSchedules);

// Get meal schedules
router.get('/schedules', getSchedules);

// Update a single schedule
router.put('/schedules/:scheduleId', updateSchedule);

// Update Schedules in bulk
router.patch('/schedules/bulk-update', bulkUpdateSchedules);

module.exports = router;