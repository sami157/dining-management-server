"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const { generateSchedulesForRange, listSchedules, updateScheduleById, deleteScheduleById, listRegistrationsForRange } = require('./meal-schedules.service');
const { asyncHandler } = require('../shared/controller.utils');
const generateSchedules = asyncHandler(async (req, res) => {
    const result = await generateSchedulesForRange(req.body, req.user?._id);
    return res.status(result.status).json({
        message: result.message,
        count: result.count,
        registrationsCreated: result.registrationsCreated
    });
});
const getSchedules = asyncHandler(async (req, res) => {
    const result = await listSchedules(req.query);
    return res.status(200).json(result);
});
const updateSchedule = asyncHandler(async (req, res) => {
    const schedule = await updateScheduleById(req.params.scheduleId, req.body);
    return res.status(200).json({ message: 'Schedule and registrations updated successfully', schedule });
});
const deleteSchedule = asyncHandler(async (req, res) => {
    const result = await deleteScheduleById(req.params.scheduleId);
    return res.status(200).json({
        message: 'Schedule deleted successfully',
        registrationsCleared: result.registrationsCleared
    });
});
const getAllRegistrations = asyncHandler(async (req, res) => {
    const result = await listRegistrationsForRange(req.query);
    return res.status(200).json(result);
});
module.exports = {
    generateSchedules,
    getSchedules,
    updateSchedule,
    deleteSchedule,
    getAllRegistrations
};
