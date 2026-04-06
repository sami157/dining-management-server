"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const { DateTime } = require('luxon');
const { getCollections } = require('../../config/connectMongodb');
const DEADLINE_CONFIG_KEY = 'global';
const MEAL_TYPES = ['morning', 'evening', 'night'];
const DEFAULT_MEAL_DEADLINES = {
    morning: { hour: 22, minute: 0, dayOffset: -1 },
    evening: { hour: 8, minute: 0, dayOffset: 0 },
    night: { hour: 14, minute: 0, dayOffset: 0 }
};
const cloneDefaultConfig = () => JSON.parse(JSON.stringify(DEFAULT_MEAL_DEADLINES));
const validateSingleMealDeadline = (mealType, config) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return `${mealType} must be an object`;
    }
    if (!Number.isInteger(config.hour) || config.hour < 0 || config.hour > 23) {
        return `${mealType}.hour must be an integer between 0 and 23`;
    }
    if (!Number.isInteger(config.minute) || config.minute < 0 || config.minute > 59) {
        return `${mealType}.minute must be an integer between 0 and 59`;
    }
    if (!Number.isInteger(config.dayOffset)) {
        return `${mealType}.dayOffset must be an integer`;
    }
    return null;
};
const validateMealDeadlineConfig = (config) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return 'Meal deadline config must be an object';
    }
    for (const mealType of MEAL_TYPES) {
        if (!Object.prototype.hasOwnProperty.call(config, mealType)) {
            return `${mealType} config is required`;
        }
        const validationError = validateSingleMealDeadline(mealType, config[mealType]);
        if (validationError) {
            return validationError;
        }
    }
    return null;
};
const ensureMealDeadlineConfig = async () => {
    const { mealDeadlines } = await getCollections();
    const now = new Date();
    const defaultConfig = cloneDefaultConfig();
    await mealDeadlines.updateOne({ key: DEADLINE_CONFIG_KEY }, {
        $setOnInsert: {
            key: DEADLINE_CONFIG_KEY,
            ...defaultConfig,
            createdAt: now,
            updatedAt: now
        }
    }, { upsert: true });
    return mealDeadlines.findOne({ key: DEADLINE_CONFIG_KEY });
};
const getMealDeadlineConfig = async () => {
    const config = await ensureMealDeadlineConfig();
    return {
        morning: config.morning,
        evening: config.evening,
        night: config.night,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy || null
    };
};
const updateMealDeadlineConfig = async (config, updatedBy) => {
    const validationError = validateMealDeadlineConfig(config);
    if (validationError) {
        throw new Error(validationError);
    }
    const { mealDeadlines } = await getCollections();
    const now = new Date();
    await mealDeadlines.updateOne({ key: DEADLINE_CONFIG_KEY }, {
        $set: {
            ...config,
            updatedAt: now,
            updatedBy: updatedBy || null
        },
        $setOnInsert: {
            key: DEADLINE_CONFIG_KEY,
            createdAt: now
        }
    }, { upsert: true });
    return getMealDeadlineConfig();
};
const calculateMealDeadline = (mealDate, mealType, customDeadline, mealDeadlineConfig) => {
    if (customDeadline) {
        return new Date(customDeadline);
    }
    const config = mealDeadlineConfig?.[mealType];
    if (!config) {
        throw new Error(`No deadline config found for meal type: ${mealType}`);
    }
    return DateTime.fromJSDate(mealDate)
        .setZone('Asia/Dhaka')
        .plus({ days: config.dayOffset })
        .set({ hour: config.hour, minute: config.minute, second: 0, millisecond: 0 })
        .toUTC()
        .toJSDate();
};
module.exports = {
    MEAL_TYPES,
    DEFAULT_MEAL_DEADLINES,
    validateMealDeadlineConfig,
    getMealDeadlineConfig,
    updateMealDeadlineConfig,
    calculateMealDeadline
};
