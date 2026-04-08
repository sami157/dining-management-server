import { ObjectId } from 'mongodb';
import { DateTime } from 'luxon';
const { getCollections } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');
const {
  BUSINESS_TIMEZONE,
  buildServiceDateEqualityQuery,
  buildServiceDateRangeQuery,
  formatServiceDate,
  normalizeBusinessDateFields,
  serviceDateToLegacyDate
} = require('../shared/date.utils');

type MealOption = {
  mealType: string;
  isAvailable: boolean;
  customDeadline: string | null;
  weight: number;
  menu: string;
};

type ScheduleRecord = {
  _id?: ObjectId;
  date: Date;
  serviceDate: string;
  isHoliday: boolean;
  availableMeals: MealOption[];
  createdBy?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type RegistrationRecord = {
  _id?: ObjectId;
  userId: ObjectId | string;
  date?: Date;
  serviceDate?: string;
  mealType: string;
  numberOfMeals: number;
  registeredAt: Date;
};

type UserSummary = {
  _id: ObjectId;
  name?: string;
  email?: string;
  mealDefault?: boolean;
  room?: string;
  role?: string;
};

type RangePayload = {
  startDate?: string;
  endDate?: string;
};

type ScheduleUpdatePayload = {
  isHoliday?: boolean;
  availableMeals?: MealOption[];
};

type MealSheetMealRegistration = {
  registrationId: ObjectId | null;
  isRegistered: boolean;
  numberOfMeals: number;
};

type MealSheetUserRecord = {
  userId: string;
  name?: string;
  email?: string;
  room?: string;
  role?: string;
  mealDefault?: boolean;
  registrations: Record<string, MealSheetMealRegistration>;
};

type NormalizedScheduleRecord = ScheduleRecord & {
  serviceDate: string;
};

type MealSheetDayRecord = {
  serviceDate: string;
  schedule: NormalizedScheduleRecord | null;
  users: MealSheetUserRecord[];
};

const buildCanonicalServiceDateRangeQuery = (startDate: string, endDate: string) => ({
  serviceDate: { $gte: startDate, $lte: endDate }
});

const buildCanonicalServiceDateEqualityQuery = (serviceDate: string) => ({ serviceDate });

const buildRegistrationServiceDateRangeQuery = (startDate: string, endDate: string) => (
  buildServiceDateRangeQuery('date', startDate, endDate)
);

const buildRegistrationServiceDateEqualityQuery = (serviceDate: string) => (
  buildServiceDateEqualityQuery('date', serviceDate)
);

const getNextServiceDate = (serviceDate: string) => (
  DateTime.fromISO(serviceDate, { zone: BUSINESS_TIMEZONE }).plus({ days: 1 }).toFormat('yyyy-LL-dd')
);

const getAvailableMealTypes = (availableMeals: MealOption[] = []) => (
  availableMeals.filter(meal => meal.isAvailable).map(meal => meal.mealType)
);

const buildDefaultUserRegistrations = async (
  schedules: ScheduleRecord[],
  scheduleToMealTypes: Map<string, string[]>
) => {
  if (schedules.length === 0) {
    return [];
  }

  const { mealRegistrations, users } = await getCollections();
  const defaultUsers = (await users.find(
    { mealDefault: true },
    { projection: { _id: 1 } }
  ).toArray()) as Array<Pick<UserSummary, '_id'>>;

  if (defaultUsers.length === 0) {
    return [];
  }

  const serviceDates = schedules.map(schedule => schedule.serviceDate);
  const relevantMealTypes = [...new Set(
    schedules.flatMap(schedule => scheduleToMealTypes.get(schedule.serviceDate) || [])
  )];

  if (relevantMealTypes.length === 0) {
    return [];
  }

  const existingRegistrations = (await mealRegistrations.find({
    $and: [
      buildRegistrationServiceDateRangeQuery(serviceDates[0], serviceDates[serviceDates.length - 1]),
      { mealType: { $in: relevantMealTypes } }
    ]
  }, {
    projection: { userId: 1, date: 1, serviceDate: 1, mealType: 1 }
  }).toArray()) as Array<Pick<RegistrationRecord, 'userId' | 'date' | 'serviceDate' | 'mealType'>>;

  const existingKeys = new Set(
    existingRegistrations.map((registration) => {
      const normalizedRegistration = normalizeBusinessDateFields(registration) as RegistrationRecord;
      return `${registration.userId.toString()}|${normalizedRegistration.serviceDate}|${registration.mealType}`;
    })
  );

  const registrations: RegistrationRecord[] = [];

  for (const schedule of schedules) {
    const mealTypes = scheduleToMealTypes.get(schedule.serviceDate) || [];
    if (mealTypes.length === 0) {
      continue;
    }

    for (const user of defaultUsers) {
      for (const mealType of mealTypes) {
        const key = `${user._id.toString()}|${schedule.serviceDate}|${mealType}`;
        if (existingKeys.has(key)) {
          continue;
        }

        existingKeys.add(key);
        registrations.push({
          userId: user._id,
          date: schedule.date,
          serviceDate: schedule.serviceDate,
          mealType,
          numberOfMeals: 1,
          registeredAt: new Date()
        });
      }
    }
  }

  return registrations;
};

const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 5 || day === 6;
};

const getDefaultMeals = (date: Date, isHoliday: boolean): MealOption[] => {
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

const generateSchedulesForRange = async ({ startDate, endDate }: RangePayload, managerId: unknown) => {
  if (!managerId) {
    throw createHttpError(401, 'Unauthorized');
  }

  if (!startDate || !endDate) {
    throw createHttpError(400, 'Start and end dates are required');
  }

  const start = serviceDateToLegacyDate(startDate);
  const end = serviceDateToLegacyDate(endDate);

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

  const { mealSchedules, mealRegistrations } = await getCollections();
  const existingSchedules = await mealSchedules.find(
    buildCanonicalServiceDateRangeQuery(startDate, endDate),
    { projection: { serviceDate: 1 } }
  ).toArray() as Array<Pick<ScheduleRecord, 'serviceDate'>>;

  const existingDates = new Set(existingSchedules.map(schedule => schedule.serviceDate));
  const schedulesToCreate: ScheduleRecord[] = [];
  const currentDate = new Date(start);

  while (currentDate <= end) {
    const dateToCheck = new Date(currentDate);
    const serviceDate = formatServiceDate(dateToCheck);
    if (!existingDates.has(serviceDate)) {
      schedulesToCreate.push({
        date: dateToCheck,
        serviceDate,
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
  const scheduleToMealTypes = new Map(
    schedulesToCreate.map(schedule => [schedule.serviceDate, getAvailableMealTypes(schedule.availableMeals)])
  );
  const registrations = await buildDefaultUserRegistrations(schedulesToCreate, scheduleToMealTypes);

  if (registrations.length > 0) {
    await mealRegistrations.insertMany(registrations);
  }

  return {
    status: 201,
    message: `${result.insertedCount} schedules created successfully`,
    count: result.insertedCount,
    registrationsCreated: registrations.length
  };
};

const listSchedules = async ({ startDate, endDate }: RangePayload) => {
  if (!startDate || !endDate) {
    throw createHttpError(400, 'startDate and endDate are required');
  }

  const start = serviceDateToLegacyDate(startDate);
  const end = serviceDateToLegacyDate(endDate);

  if (start > end) {
    throw createHttpError(400, 'startDate must be before endDate');
  }

  const { mealSchedules } = await getCollections();
  const schedules = await mealSchedules.find(buildCanonicalServiceDateRangeQuery(startDate, endDate)).sort({ serviceDate: 1 }).toArray() as ScheduleRecord[];
  return { count: schedules.length, schedules: schedules.map((schedule) => normalizeBusinessDateFields(schedule)) };
};

const buildMealSheetDayRecord = (
  serviceDate: string,
  schedule: ScheduleRecord | null,
  usersList: UserSummary[],
  registrations: RegistrationRecord[]
): MealSheetDayRecord => {
  const normalizedSchedule = normalizeBusinessDateFields(schedule) as NormalizedScheduleRecord | null;
  const mealTypes = (normalizedSchedule?.availableMeals || []).map((meal) => meal.mealType);
  const registrationsByUserId = new Map<string, Record<string, MealSheetMealRegistration>>();

  for (const registration of registrations) {
    const userId = registration.userId.toString();
    const userRegistrations = registrationsByUserId.get(userId) || {};
    userRegistrations[registration.mealType] = {
      registrationId: registration._id || null,
      isRegistered: true,
      numberOfMeals: registration.numberOfMeals || 1
    };
    registrationsByUserId.set(userId, userRegistrations);
  }

  const users = usersList.map((user) => {
    const userId = user._id.toString();
    const registrationMap = registrationsByUserId.get(userId) || {};
    const registrationsByMealType: Record<string, MealSheetMealRegistration> = {};

    for (const mealType of mealTypes) {
      registrationsByMealType[mealType] = registrationMap[mealType] || {
        registrationId: null,
        isRegistered: false,
        numberOfMeals: 0
      };
    }

    return {
      userId,
      name: user.name,
      email: user.email,
      room: user.room,
      role: user.role,
      mealDefault: user.mealDefault,
      registrations: registrationsByMealType
    };
  });

  return {
    serviceDate,
    schedule: normalizedSchedule,
    users
  };
};

const getMealSheetForDate = async (date: string) => {
  if (!date) {
    throw createHttpError(400, 'date is required');
  }

  const firstDate = formatServiceDate(date);
  const secondDate = getNextServiceDate(firstDate);
  const targetDates = [firstDate, secondDate];
  const { mealSchedules, mealRegistrations, users } = await getCollections();

  const [schedules, registrations, usersList] = await Promise.all([
    mealSchedules.find({ serviceDate: { $in: targetDates } }).toArray() as Promise<ScheduleRecord[]>,
    mealRegistrations.find(buildRegistrationServiceDateRangeQuery(firstDate, secondDate)).toArray() as Promise<RegistrationRecord[]>,
    users.find({}, {
      projection: { _id: 1, name: 1, email: 1, mealDefault: 1, room: 1, role: 1 }
    }).sort({ room: 1, name: 1 }).toArray() as Promise<UserSummary[]>
  ]);

  const scheduleByDate = new Map(schedules.map((schedule) => [schedule.serviceDate, schedule] as const));
  const registrationsByDate = new Map<string, RegistrationRecord[]>();

  for (const registration of registrations) {
    const normalizedRegistration = normalizeBusinessDateFields(registration) as RegistrationRecord;
    const registrationServiceDate = normalizedRegistration.serviceDate;
    if (!registrationServiceDate || !targetDates.includes(registrationServiceDate)) {
      continue;
    }

    const existingRegistrations = registrationsByDate.get(registrationServiceDate) || [];
    existingRegistrations.push(normalizedRegistration);
    registrationsByDate.set(registrationServiceDate, existingRegistrations);
  }

  const records = targetDates.map((serviceDate) => buildMealSheetDayRecord(
    serviceDate,
    scheduleByDate.get(serviceDate) || null,
    usersList,
    registrationsByDate.get(serviceDate) || []
  ));

  return {
    date: firstDate,
    nextDate: secondDate,
    count: records.length,
    records
  };
};

const updateScheduleById = async (scheduleId: string, { isHoliday, availableMeals }: ScheduleUpdatePayload) => {
  if (!ObjectId.isValid(scheduleId)) {
    throw createHttpError(400, 'Invalid schedule ID');
  }

  if (availableMeals && !Array.isArray(availableMeals)) {
    throw createHttpError(400, 'availableMeals must be an array');
  }

  const updateData: Partial<ScheduleRecord> = { updatedAt: new Date() };
  if (isHoliday !== undefined) {
    updateData.isHoliday = isHoliday;
  }

  const { mealSchedules, mealRegistrations } = await getCollections();
  const existingSchedule = await mealSchedules.findOne({ _id: new ObjectId(scheduleId) }) as ScheduleRecord | null;

  if (!existingSchedule) {
    throw createHttpError(404, 'Schedule not found');
  }

  const previousAvailableMealTypes = new Set(getAvailableMealTypes(existingSchedule.availableMeals));

  if (availableMeals) {
    updateData.availableMeals = availableMeals.map(meal => ({
      mealType: meal.mealType,
      isAvailable: meal.isAvailable,
      customDeadline: meal.customDeadline || null,
      weight: meal.isAvailable ? (meal.weight !== undefined ? meal.weight : 1) : 0,
      menu: meal.menu || ''
    }));
  }

  const schedule = await mealSchedules.findOneAndUpdate(
    { _id: new ObjectId(scheduleId) },
    { $set: updateData },
    { returnDocument: 'after' }
  ) as ScheduleRecord | null;

  if (!schedule) {
    throw createHttpError(404, 'Schedule not found');
  }

  const nextAvailableMealTypes = getAvailableMealTypes(schedule.availableMeals);

  const unavailableMealTypes = schedule.availableMeals
    .filter(meal => !meal.isAvailable)
    .map(meal => meal.mealType);

  if (unavailableMealTypes.length > 0) {
    await mealRegistrations.deleteMany({
      ...buildRegistrationServiceDateEqualityQuery(schedule.serviceDate),
      mealType: { $in: unavailableMealTypes }
    });
  }

  const newlyAvailableMealTypes = nextAvailableMealTypes.filter(mealType => !previousAvailableMealTypes.has(mealType));

  if (newlyAvailableMealTypes.length > 0) {
    const registrations = await buildDefaultUserRegistrations(
      [schedule],
      new Map([[schedule.serviceDate, newlyAvailableMealTypes]])
    );

    if (registrations.length > 0) {
      await mealRegistrations.insertMany(registrations);
    }
  }

  return normalizeBusinessDateFields(schedule);
};

const deleteScheduleById = async (scheduleId: string) => {
  if (!ObjectId.isValid(scheduleId)) {
    throw createHttpError(400, 'Invalid schedule ID');
  }

  const { mealSchedules, mealRegistrations } = await getCollections();
  const schedule = await mealSchedules.findOneAndDelete({ _id: new ObjectId(scheduleId) }) as ScheduleRecord | null;

  if (!schedule) {
    throw createHttpError(404, 'Schedule not found');
  }

  const { deletedCount } = await mealRegistrations.deleteMany(
    buildRegistrationServiceDateEqualityQuery(schedule.serviceDate)
  );
  return { registrationsCleared: deletedCount };
};

const listRegistrationsForRange = async ({ startDate, endDate }: RangePayload) => {
  if (!startDate || !endDate) {
    throw createHttpError(400, 'startDate and endDate query parameters are required');
  }

  const start = serviceDateToLegacyDate(startDate);
  const end = serviceDateToLegacyDate(endDate);

  if (start > end) {
    throw createHttpError(400, 'startDate must be before endDate');
  }

  const { mealRegistrations, users } = await getCollections();
  const registrations = await mealRegistrations.find(
    buildRegistrationServiceDateRangeQuery(startDate, endDate)
  ).sort({ serviceDate: 1, userId: 1, mealType: 1 }).toArray() as RegistrationRecord[];

  const userIds = [...new Set(registrations.map(registration => registration.userId))];
  const usersMap: Record<string, { name?: string; email?: string }> = {};

  if (userIds.length > 0) {
    const usersList = await users.find({
      _id: { $in: userIds.map(id => new ObjectId(id)) }
    }).toArray() as UserSummary[];

    usersList.forEach(user => {
      usersMap[user._id.toString()] = { name: user.name, email: user.email };
    });
  }

  const enrichedRegistrations = registrations.map((registration) => {
    const normalizedRegistration = normalizeBusinessDateFields(registration) as RegistrationRecord;
    return {
      ...normalizedRegistration,
      user: usersMap[registration.userId.toString()] || null
    };
  });

  return {
    count: enrichedRegistrations.length,
    startDate,
    endDate,
    registrations: enrichedRegistrations
  };
};

export = {
  generateSchedulesForRange,
  listSchedules,
  getMealSheetForDate,
  updateScheduleById,
  deleteScheduleById,
  listRegistrationsForRange
};

