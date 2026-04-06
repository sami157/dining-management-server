"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const { ObjectId } = require('mongodb');
const { getCollections } = require('../../config/connectMongodb');
const createHttpError = (status, message) => {
    const error = new Error(message);
    error.status = status;
    return error;
};
const isWeekend = (date) => {
    const day = date.getDay();
    return day === 5 || day === 6;
};
const getDefaultMeals = (date, isHoliday) => {
    if (isWeekend(date) || isHoliday) {
        return [
            { mealType: 'morning', isAvailable: true, customDeadline: null, weight: 0.5, menu: '' },
            { mealType: 'evening', isAvailable: true, customDeadline: null, weight: 1, menu: '' },
            { mealType: 'night', isAvailable: true, customDeadline: null, weight: 1, menu: '' }
        ];
    }
    return [
        { mealType: 'morning', isAvailable: false, customDeadline: null, weight: 0.5, menu: '' },
        { mealType: 'evening', isAvailable: false, customDeadline: null, weight: 1, menu: '' },
        { mealType: 'night', isAvailable: true, customDeadline: null, weight: 1, menu: '' }
    ];
};
const generateSchedulesForRange = async ({ startDate, endDate }, managerId) => {
    if (!managerId) {
        throw createHttpError(401, 'Unauthorized');
    }
    if (!startDate || !endDate) {
        throw createHttpError(400, 'Start and end dates are required');
    }
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    if (isNaN(start) || isNaN(end)) {
        throw createHttpError(400, 'Invalid date format');
    }
    if (start > end) {
        throw createHttpError(400, 'startDate must be before endDate');
    }
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    if (diffDays > 90) {
        throw createHttpError(400, 'Date range cannot exceed 90 days');
    }
    const { mealSchedules, mealRegistrations, users } = await getCollections();
    const [existingSchedules, defaultUsers] = await Promise.all([
        mealSchedules.find({ date: { $gte: start, $lte: end } }, { projection: { date: 1 } }).toArray(),
        users.find({ mealDefault: true }, { projection: { _id: 1 } }).toArray()
    ]);
    const existingDates = new Set(existingSchedules.map(schedule => schedule.date.getTime()));
    const schedulesToCreate = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
        const dateToCheck = new Date(currentDate);
        if (!existingDates.has(dateToCheck.getTime())) {
            schedulesToCreate.push({
                date: dateToCheck,
                isHoliday: false,
                availableMeals: getDefaultMeals(currentDate, false),
                createdBy: managerId,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    if (schedulesToCreate.length === 0) {
        return {
            status: 200,
            message: 'All schedules already exist for this date range',
            count: 0
        };
    }
    const result = await mealSchedules.insertMany(schedulesToCreate);
    if (defaultUsers.length > 0) {
        const registrations = [];
        for (const schedule of schedulesToCreate) {
            const availableMealTypes = schedule.availableMeals
                .filter(meal => meal.isAvailable)
                .map(meal => meal.mealType);
            for (const user of defaultUsers) {
                for (const mealType of availableMealTypes) {
                    registrations.push({
                        userId: user._id,
                        date: schedule.date,
                        mealType,
                        numberOfMeals: 1,
                        registeredAt: new Date()
                    });
                }
            }
        }
        if (registrations.length > 0) {
            await mealRegistrations.insertMany(registrations);
        }
    }
    return {
        status: 201,
        message: `${result.insertedCount} schedules created successfully`,
        count: result.insertedCount,
        registrationsCreated: defaultUsers.length * schedulesToCreate.length
    };
};
const listSchedules = async ({ startDate, endDate }) => {
    if (!startDate || !endDate) {
        throw createHttpError(400, 'startDate and endDate are required');
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
        throw createHttpError(400, 'startDate must be before endDate');
    }
    const { mealSchedules } = await getCollections();
    const schedules = await mealSchedules.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 }).toArray();
    return { count: schedules.length, schedules };
};
const updateScheduleById = async (scheduleId, { isHoliday, availableMeals }) => {
    if (!ObjectId.isValid(scheduleId)) {
        throw createHttpError(400, 'Invalid schedule ID');
    }
    if (availableMeals && !Array.isArray(availableMeals)) {
        throw createHttpError(400, 'availableMeals must be an array');
    }
    const updateData = { updatedAt: new Date() };
    if (isHoliday !== undefined) {
        updateData.isHoliday = isHoliday;
    }
    if (availableMeals) {
        updateData.availableMeals = availableMeals.map(meal => ({
            mealType: meal.mealType,
            isAvailable: meal.isAvailable,
            customDeadline: meal.customDeadline || null,
            weight: meal.isAvailable ? (meal.weight !== undefined ? meal.weight : 1) : 0,
            menu: meal.menu || ''
        }));
    }
    const { mealSchedules, mealRegistrations } = await getCollections();
    const schedule = await mealSchedules.findOneAndUpdate({ _id: new ObjectId(scheduleId) }, { $set: updateData }, { returnDocument: 'after' });
    if (!schedule) {
        throw createHttpError(404, 'Schedule not found');
    }
    const unavailableMealTypes = schedule.availableMeals
        .filter(meal => !meal.isAvailable)
        .map(meal => meal.mealType);
    if (unavailableMealTypes.length > 0) {
        await mealRegistrations.deleteMany({
            date: schedule.date,
            mealType: { $in: unavailableMealTypes }
        });
    }
    return schedule;
};
const deleteScheduleById = async (scheduleId) => {
    if (!ObjectId.isValid(scheduleId)) {
        throw createHttpError(400, 'Invalid schedule ID');
    }
    const { mealSchedules, mealRegistrations } = await getCollections();
    const schedule = await mealSchedules.findOneAndDelete({ _id: new ObjectId(scheduleId) });
    if (!schedule) {
        throw createHttpError(404, 'Schedule not found');
    }
    const { deletedCount } = await mealRegistrations.deleteMany({ date: schedule.date });
    return { registrationsCleared: deletedCount };
};
const listRegistrationsForRange = async ({ startDate, endDate }) => {
    if (!startDate || !endDate) {
        throw createHttpError(400, 'startDate and endDate query parameters are required');
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
        throw createHttpError(400, 'startDate must be before endDate');
    }
    const { mealRegistrations, users } = await getCollections();
    const registrations = await mealRegistrations.find({
        date: { $gte: start, $lte: end }
    }).sort({ date: 1, userId: 1, mealType: 1 }).toArray();
    const userIds = [...new Set(registrations.map(registration => registration.userId))];
    const usersMap = {};
    if (userIds.length > 0) {
        const usersList = await users.find({
            _id: { $in: userIds.map(id => new ObjectId(id)) }
        }).toArray();
        usersList.forEach(user => {
            usersMap[user._id.toString()] = { name: user.name, email: user.email };
        });
    }
    const enrichedRegistrations = registrations.map(registration => ({
        ...registration,
        user: usersMap[registration.userId] || null
    }));
    return {
        count: enrichedRegistrations.length,
        startDate,
        endDate,
        registrations: enrichedRegistrations
    };
};
module.exports = {
    generateSchedulesForRange,
    listSchedules,
    updateScheduleById,
    deleteScheduleById,
    listRegistrationsForRange
};
