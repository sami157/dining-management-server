import { DateTime } from 'luxon';
const { getCollections } = require('../../config/connectMongodb');
const { BUSINESS_TIMEZONE, serviceDateToBusinessDayStartUtc } = require('../shared/date.utils');

const DEADLINE_CONFIG_KEY = 'global';
const MEAL_TYPES = ['morning', 'evening', 'night'] as const;
const DEFAULT_MEAL_DEADLINES = {
  morning: { hour: 22, minute: 0, dayOffset: -1 },
  evening: { hour: 8, minute: 0, dayOffset: 0 },
  night: { hour: 14, minute: 0, dayOffset: 0 }
};

type MealDeadlineType = typeof MEAL_TYPES[number];
type MealDeadlineRule = {
  hour: number;
  minute: number;
  dayOffset: number;
};

type MealDeadlineConfig = Record<MealDeadlineType, MealDeadlineRule> & {
  updatedAt?: Date;
  updatedBy?: unknown;
  createdAt?: Date;
  key?: string;
};

const cloneDefaultConfig = (): MealDeadlineConfig => JSON.parse(JSON.stringify(DEFAULT_MEAL_DEADLINES));

const validateSingleMealDeadline = (mealType: MealDeadlineType, config: unknown) => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return `${mealType} must be an object`;
  }

  const rule = config as Partial<MealDeadlineRule>;

  if (!Number.isInteger(rule.hour) || rule.hour < 0 || rule.hour > 23) {
    return `${mealType}.hour must be an integer between 0 and 23`;
  }

  if (!Number.isInteger(rule.minute) || rule.minute < 0 || rule.minute > 59) {
    return `${mealType}.minute must be an integer between 0 and 59`;
  }

  if (!Number.isInteger(rule.dayOffset)) {
    return `${mealType}.dayOffset must be an integer`;
  }

  return null;
};

const validateMealDeadlineConfig = (config: unknown) => {
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

const ensureMealDeadlineConfig = async (): Promise<MealDeadlineConfig> => {
  const { mealDeadlines } = await getCollections();
  const now = new Date();
  const defaultConfig = cloneDefaultConfig();

  await mealDeadlines.updateOne(
    { key: DEADLINE_CONFIG_KEY },
    {
      $setOnInsert: {
        key: DEADLINE_CONFIG_KEY,
        ...defaultConfig,
        createdAt: now,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  return mealDeadlines.findOne({ key: DEADLINE_CONFIG_KEY }) as Promise<MealDeadlineConfig>;
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

const updateMealDeadlineConfig = async (config: MealDeadlineConfig, updatedBy: unknown) => {
  const validationError = validateMealDeadlineConfig(config);
  if (validationError) {
    throw new Error(validationError);
  }

  const { mealDeadlines } = await getCollections();
  const now = new Date();

  await mealDeadlines.updateOne(
    { key: DEADLINE_CONFIG_KEY },
    {
      $set: {
        ...config,
        updatedAt: now,
        updatedBy: updatedBy || null
      },
      $setOnInsert: {
        key: DEADLINE_CONFIG_KEY,
        createdAt: now
      }
    },
    { upsert: true }
  );

  return getMealDeadlineConfig();
};

const calculateMealDeadline = (
  mealDate: string | Date,
  mealType: MealDeadlineType | string,
  customDeadline: string | Date | null,
  mealDeadlineConfig: MealDeadlineConfig
) => {
  if (customDeadline) {
    return new Date(customDeadline);
  }

  const config = mealDeadlineConfig?.[mealType as MealDeadlineType];
  if (!config) {
    throw new Error(`No deadline config found for meal type: ${mealType}`);
  }

  const businessDay = typeof mealDate === 'string'
    ? DateTime.fromJSDate(serviceDateToBusinessDayStartUtc(mealDate), { zone: 'utc' }).setZone(BUSINESS_TIMEZONE)
    : DateTime.fromJSDate(mealDate, { zone: 'utc' }).setZone(BUSINESS_TIMEZONE);

  return businessDay
    .plus({ days: config.dayOffset })
    .set({ hour: config.hour, minute: config.minute, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
};

export = {
  MEAL_TYPES,
  DEFAULT_MEAL_DEADLINES,
  validateMealDeadlineConfig,
  getMealDeadlineConfig,
  updateMealDeadlineConfig,
  calculateMealDeadline
};

