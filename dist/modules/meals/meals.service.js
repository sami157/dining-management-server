"use strict";
const mongodb_1 = require("mongodb");
const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');
const { formatServiceDate, getMonthServiceDateRange, normalizeBusinessDateFields, serviceDateToLegacyDate } = require('../shared/date.utils');
const { calculateMealDeadline, getMealDeadlineConfig } = require('../meal-deadlines/meal-deadlines.service');
const { assertRolePolicy, assertMealDeadlineNotPassed, assertRegistrationOwnershipOrPrivileged, isPrivilegedRole } = require('../shared/service-rules');
const buildCanonicalServiceDateRangeQuery = (startDate, endDate) => ({
    serviceDate: { $gte: startDate, $lte: endDate }
});
const buildCanonicalServiceDateEqualityQuery = (serviceDate) => ({ serviceDate });
const getAvailableMealsForUser = async (userId, query) => {
    const { startDate, endDate, month } = query;
    const currentTime = new Date();
    let start;
    let end;
    if (month) {
        const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
        if (!monthRegex.test(month)) {
            throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
        }
        const range = getMonthServiceDateRange(month);
        start = range.startServiceDate;
        end = range.endServiceDate;
    }
    else {
        if (!startDate || !endDate) {
            throw createHttpError(400, 'Either month OR both startDate and endDate are required');
        }
        start = startDate;
        end = endDate;
    }
    const { mealSchedules, mealRegistrations } = await getCollections();
    const [schedules, userRegistrations, mealDeadlineConfig] = await Promise.all([
        mealSchedules.find(buildCanonicalServiceDateRangeQuery(start, end)).sort({ serviceDate: 1 }).toArray(),
        mealRegistrations.find({ userId, ...buildCanonicalServiceDateRangeQuery(start, end) }).toArray(),
        getMealDeadlineConfig()
    ]);
    const registrationMap = {};
    userRegistrations.forEach(reg => {
        const key = `${reg.serviceDate}_${reg.mealType}`;
        registrationMap[key] = reg;
    });
    const schedulesWithMeals = schedules.map(schedule => {
        const normalizedSchedule = normalizeBusinessDateFields(schedule);
        const meals = schedule.availableMeals.map(meal => {
            const deadline = calculateMealDeadline(normalizedSchedule.serviceDate, meal.mealType, meal.customDeadline, mealDeadlineConfig);
            const registrationKey = `${normalizedSchedule.serviceDate}_${meal.mealType}`;
            const existingRegistration = registrationMap[registrationKey];
            const isRegistered = Boolean(existingRegistration);
            return {
                mealType: meal.mealType,
                isAvailable: meal.isAvailable,
                menu: meal.menu || '',
                weight: meal.weight || 1,
                deadline,
                canRegister: meal.isAvailable && currentTime <= deadline && !isRegistered,
                isRegistered,
                registrationId: isRegistered ? existingRegistration._id : null,
                numberOfMeals: isRegistered ? existingRegistration.numberOfMeals || 1 : null
            };
        });
        return { date: schedule.date, serviceDate: normalizedSchedule.serviceDate, isHoliday: schedule.isHoliday, meals };
    });
    return { count: schedulesWithMeals.length, schedules: schedulesWithMeals };
};
const createMealRegistration = async (payload, currentUser) => {
    const { date, mealType, userId: requestUserId, numberOfMeals } = payload;
    let userId = currentUser?._id;
    let isLateRegistration = false;
    const currentTime = new Date();
    if (requestUserId) {
        assertRolePolicy(currentUser.role, 'mealRegistrationOverride', 'Not authorized to register for others');
        userId = new mongodb_1.ObjectId(requestUserId);
    }
    if (!date || !mealType) {
        throw createHttpError(400, 'date and mealType are required');
    }
    if (!['morning', 'evening', 'night'].includes(mealType)) {
        throw createHttpError(400, 'mealType must be morning, evening, or night');
    }
    const serviceDate = formatServiceDate(date);
    const mealDate = serviceDateToLegacyDate(serviceDate);
    const { mealSchedules, mealRegistrations, users, systemLogs } = await getCollections();
    const mealDeadlineConfig = await getMealDeadlineConfig();
    const schedule = await mealSchedules.findOne(buildCanonicalServiceDateEqualityQuery(serviceDate));
    if (!schedule) {
        throw createHttpError(404, 'No meal schedule found for this date');
    }
    const meal = schedule.availableMeals.find(item => item.mealType === mealType);
    if (!meal || !meal.isAvailable) {
        throw createHttpError(400, 'This meal is not available on this date');
    }
    if (!requestUserId) {
        assertMealDeadlineNotPassed({
            serviceDate,
            mealType,
            customDeadline: meal.customDeadline,
            mealDeadlineConfig,
            message: 'Registration deadline has passed for this meal'
        });
    }
    const existingRegistration = await mealRegistrations.findOne({ userId, mealType, ...buildCanonicalServiceDateEqualityQuery(serviceDate) });
    if (existingRegistration) {
        throw createHttpError(400, 'You have already registered for this meal');
    }
    const registration = {
        userId,
        date: mealDate,
        serviceDate,
        mealType,
        numberOfMeals: numberOfMeals || 1,
        registeredAt: new Date()
    };
    const result = await mealRegistrations.insertOne(registration);
    if (requestUserId) {
        const deadline = calculateMealDeadline(serviceDate, mealType, meal.customDeadline, mealDeadlineConfig);
        if (currentTime > deadline) {
            isLateRegistration = true;
        }
    }
    if (isLateRegistration) {
        const [byPerson, forPerson] = await Promise.all([
            users.findOne({ _id: new mongodb_1.ObjectId(currentUser?._id) }, { projection: { name: 1 } }),
            users.findOne({ _id: userId }, { projection: { name: 1 } })
        ]);
        await systemLogs.insertOne({
            type: 'meal-on',
            byPerson,
            forPerson,
            registration
        });
    }
    return {
        message: 'Meal registered successfully',
        registrationId: result.insertedId,
        registration: { ...registration, _id: result.insertedId }
    };
};
const editMealRegistration = async (registrationId, numberOfMeals, currentUser) => {
    if (!mongodb_1.ObjectId.isValid(registrationId)) {
        throw createHttpError(400, 'Invalid registration ID');
    }
    if (!numberOfMeals || typeof numberOfMeals !== 'number' || numberOfMeals < 1) {
        throw createHttpError(400, 'numberOfMeals must be a positive number');
    }
    const { mealRegistrations, mealSchedules } = await getCollections();
    const mealDeadlineConfig = await getMealDeadlineConfig();
    const registration = await mealRegistrations.findOne({ _id: new mongodb_1.ObjectId(registrationId) });
    if (!registration) {
        throw createHttpError(404, 'Registration not found');
    }
    assertRegistrationOwnershipOrPrivileged(registration, currentUser, 'You can only update your own registration');
    if (!isPrivilegedRole(currentUser.role)) {
        const schedule = await mealSchedules.findOne(buildCanonicalServiceDateEqualityQuery(registration.serviceDate));
        if (!schedule) {
            throw createHttpError(404, 'Meal schedule not found for this date');
        }
        const mealConfig = schedule.availableMeals.find(item => item.mealType === registration.mealType);
        if (!mealConfig || !mealConfig.isAvailable) {
            throw createHttpError(400, 'Meal is no longer available for modification');
        }
        assertMealDeadlineNotPassed({
            serviceDate: registration.serviceDate,
            mealType: registration.mealType,
            customDeadline: mealConfig.customDeadline || null,
            mealDeadlineConfig,
            message: 'Deadline has passed. Changes are no longer allowed.'
        });
    }
    await mealRegistrations.updateOne({ _id: new mongodb_1.ObjectId(registrationId) }, { $set: { numberOfMeals, updatedAt: new Date() } });
};
const removeMealRegistration = async (registrationId, currentUser) => {
    if (!mongodb_1.ObjectId.isValid(registrationId)) {
        throw createHttpError(400, 'Invalid registration ID');
    }
    const { users, mealRegistrations, mealSchedules, systemLogs } = await getCollections();
    const mealDeadlineConfig = await getMealDeadlineConfig();
    const user = await users.findOne({ _id: currentUser?._id });
    const registration = await mealRegistrations.findOne({ _id: new mongodb_1.ObjectId(registrationId) });
    if (!registration) {
        throw createHttpError(404, 'Registration not found');
    }
    const { isOwner } = assertRegistrationOwnershipOrPrivileged(registration, currentUser, 'You can only cancel your own registration');
    if (!isPrivilegedRole(user.role)) {
        const schedule = await mealSchedules.findOne(buildCanonicalServiceDateEqualityQuery(registration.serviceDate));
        if (!schedule) {
            throw createHttpError(404, 'Meal schedule not found');
        }
        const meal = schedule.availableMeals.find(item => item.mealType === registration.mealType);
        if (!meal) {
            throw createHttpError(400, 'Meal configuration not found');
        }
        assertMealDeadlineNotPassed({
            serviceDate: registration.serviceDate,
            mealType: registration.mealType,
            customDeadline: meal.customDeadline,
            mealDeadlineConfig,
            message: 'Cancellation deadline has passed for this meal'
        });
    }
    if (!isOwner) {
        const [byPerson, forPerson] = await Promise.all([
            users.findOne({ _id: new mongodb_1.ObjectId(currentUser?._id) }, { projection: { name: 1 } }),
            users.findOne({ _id: registration.userId }, { projection: { name: 1 } })
        ]);
        await systemLogs.insertOne({
            type: 'meal-off',
            byPerson,
            forPerson,
            mealDate: registration.mealDate,
            mealType: registration.mealType,
            cancelledAt: new Date()
        });
    }
    await mealRegistrations.deleteOne({ _id: new mongodb_1.ObjectId(registrationId) });
};
const getMealTotalsForUser = async (email, month) => {
    const { users, mealRegistrations, mealSchedules } = await getCollections();
    const user = await users.findOne({ email });
    if (!user) {
        throw createHttpError(404, 'User not found');
    }
    if (month) {
        const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
        if (!monthRegex.test(month)) {
            throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
        }
    }
    let start;
    let end;
    if (month) {
        const range = getMonthServiceDateRange(month);
        start = range.startServiceDate;
        end = range.endServiceDate;
    }
    else {
        const range = getMonthServiceDateRange(formatServiceDate().slice(0, 7));
        start = range.startServiceDate;
        end = range.endServiceDate;
    }
    const [registrations, schedules] = await Promise.all([
        mealRegistrations.find({ userId: user._id, ...buildCanonicalServiceDateRangeQuery(start, end) }).toArray(),
        mealSchedules.find(buildCanonicalServiceDateRangeQuery(start, end)).toArray()
    ]);
    const scheduleMap = {};
    for (const schedule of schedules) {
        scheduleMap[schedule.serviceDate] = schedule;
    }
    let totalMeals = 0;
    const mealBreakdown = { morning: 0, evening: 0, night: 0 };
    for (const registration of registrations) {
        const schedule = scheduleMap[registration.serviceDate];
        if (!schedule)
            continue;
        const meal = schedule.availableMeals.find(item => item.mealType === registration.mealType);
        if (!meal)
            continue;
        const weight = meal.weight || 1;
        const count = registration.numberOfMeals || 1;
        totalMeals += count * weight;
        mealBreakdown[registration.mealType] += count * weight;
    }
    const currentMonth = month || start.slice(0, 7);
    return {
        userId: user._id,
        userName: user.name,
        email: user.email,
        month: currentMonth,
        totalMeals,
        mealCount: registrations.length,
        breakdown: mealBreakdown,
        registrations: registrations.length
    };
};
const bulkRegisterMealsForUser = async (month, userId) => {
    if (!month) {
        throw createHttpError(400, 'month is required (format: YYYY-MM)');
    }
    const { startServiceDate, endServiceDate } = getMonthServiceDateRange(month);
    const currentTime = new Date();
    const { mealSchedules, mealRegistrations } = await getCollections();
    const [schedules, existingRegistrations, mealDeadlineConfig] = await Promise.all([
        mealSchedules.find(buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate)).toArray(),
        mealRegistrations.find({ userId, ...buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate) }).toArray(),
        getMealDeadlineConfig()
    ]);
    const registeredSet = new Set(existingRegistrations.map(reg => `${reg.serviceDate}_${reg.mealType}`));
    const toInsert = [];
    for (const schedule of schedules) {
        for (const meal of schedule.availableMeals) {
            if (!meal.isAvailable)
                continue;
            const scheduleServiceDate = schedule.serviceDate;
            const key = `${scheduleServiceDate}_${meal.mealType}`;
            if (registeredSet.has(key))
                continue;
            const deadline = calculateMealDeadline(scheduleServiceDate, meal.mealType, meal.customDeadline, mealDeadlineConfig);
            if (currentTime > deadline)
                continue;
            toInsert.push({
                userId,
                date: schedule.date,
                serviceDate: scheduleServiceDate,
                mealType: meal.mealType,
                numberOfMeals: 1,
                registeredAt: new Date()
            });
        }
    }
    if (toInsert.length === 0) {
        return {
            message: 'No available meals to register for',
            registeredCount: 0,
            status: 200
        };
    }
    await mealRegistrations.insertMany(toInsert);
    return {
        message: `Successfully registered for ${toInsert.length} meals`,
        registeredCount: toInsert.length,
        status: 201
    };
};
module.exports = {
    getAvailableMealsForUser,
    createMealRegistration,
    editMealRegistration,
    removeMealRegistration,
    getMealTotalsForUser,
    bulkRegisterMealsForUser
};
