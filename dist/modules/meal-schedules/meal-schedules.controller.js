"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllRegistrations = exports.deleteSchedule = exports.updateSchedule = exports.getSchedules = exports.generateSchedules = void 0;
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
exports.generateSchedules = generateSchedules;
const getSchedules = asyncHandler(async (req, res) => {
    const result = await listSchedules(req.query);
    return res.status(200).json(result);
});
exports.getSchedules = getSchedules;
const updateSchedule = asyncHandler(async (req, res) => {
    const schedule = await updateScheduleById(req.params.scheduleId, req.body);
    return res.status(200).json({ message: 'Schedule and registrations updated successfully', schedule });
});
exports.updateSchedule = updateSchedule;
const deleteSchedule = asyncHandler(async (req, res) => {
    const result = await deleteScheduleById(req.params.scheduleId);
    return res.status(200).json({
        message: 'Schedule deleted successfully',
        registrationsCleared: result.registrationsCleared
    });
});
exports.deleteSchedule = deleteSchedule;
const getAllRegistrations = asyncHandler(async (req, res) => {
    const result = await listRegistrationsForRange(req.query);
    return res.status(200).json(result);
});
exports.getAllRegistrations = getAllRegistrations;
