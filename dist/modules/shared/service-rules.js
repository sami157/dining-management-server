"use strict";
// @ts-nocheck
const { createHttpError } = require('../../middleware/errorHandler');
const { calculateMealDeadline } = require('../meal-deadlines/meal-deadlines.service');
const hasAllowedRole = (currentRole, allowedRoles = []) => {
    return allowedRoles.includes(currentRole);
};
const assertAllowedRole = (currentRole, allowedRoles = [], message = 'You are not authorized') => {
    if (!hasAllowedRole(currentRole, allowedRoles)) {
        throw createHttpError(403, message);
    }
};
const isPrivilegedRole = (currentRole) => hasAllowedRole(currentRole, ['admin', 'super_admin']);
const assertMonthIsNotFinalized = async (monthlyFinalization, month, options = {}) => {
    const finalized = await monthlyFinalization.findOne({ month }, options);
    if (finalized) {
        throw createHttpError(400, `Cannot modify records for ${month} - month is already finalized`);
    }
};
const assertMealDeadlineNotPassed = ({ serviceDate, mealType, customDeadline = null, mealDeadlineConfig, message }) => {
    const deadline = calculateMealDeadline(serviceDate, mealType, customDeadline, mealDeadlineConfig);
    if (new Date() > deadline) {
        throw createHttpError(400, message);
    }
    return deadline;
};
const assertRegistrationOwnershipOrPrivileged = (registration, currentUser, message) => {
    const currentUserId = currentUser?._id;
    const isOwner = Boolean(currentUserId && registration.userId?.equals?.(currentUserId));
    if (!isOwner && !isPrivilegedRole(currentUser?.role)) {
        throw createHttpError(403, message);
    }
    return { isOwner };
};
module.exports = {
    hasAllowedRole,
    assertAllowedRole,
    isPrivilegedRole,
    assertMonthIsNotFinalized,
    assertMealDeadlineNotPassed,
    assertRegistrationOwnershipOrPrivileged
};
