const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getDhakaTodayStartDate,
  getMealDefaultRegistrationCandidates,
  createMealDefaultRegistrations,
  applyMealDefaultPreference
} = require('./meal-default.utils');

const makeCursor = values => ({
  sort() { return this; },
  async toArray() { return values; }
});

const makeCollections = ({ schedules = [], registrations = [], finalizedMonths = [] } = {}) => {
  const state = {
    schedules: [...schedules],
    registrations: [...registrations],
    finalizedMonths: [...finalizedMonths],
    user: null,
    registrationQueries: 0,
    scheduleQueries: 0,
    writes: 0
  };

  return {
    state,
    users: {
      async findOneAndUpdate(filter, update) {
        if (!state.user || state.user._id !== filter._id) return null;
        state.user = { ...state.user, ...update.$set };
        return { ...state.user };
      },
      async updateOne(filter, update) {
        if (state.user?._id === filter._id && state.user.mealDefault === filter.mealDefault) {
          state.user = { ...state.user, ...update.$set };
        }
        return { matchedCount: state.user ? 1 : 0 };
      }
    },
    mealSchedules: {
      find(query) {
        state.scheduleQueries += 1;
        const matches = state.schedules.filter(schedule => schedule.date >= query.date.$gte);
        return makeCursor(matches);
      }
    },
    mealRegistrations: {
      find(query) {
        state.registrationQueries += 1;
        return makeCursor(state.registrations.filter(registration =>
          registration.userId === query.userId && registration.date >= query.date.$gte
        ));
      },
      async bulkWrite(operations) {
        state.writes += operations.length;
        let upsertedCount = 0;
        for (const operation of operations) {
          const { filter, update } = operation.updateOne;
          const exists = state.registrations.some(registration =>
            registration.userId === filter.userId &&
            registration.date.getTime() === filter.date.getTime() &&
            registration.mealType === filter.mealType
          );
          if (!exists) {
            state.registrations.push({ ...update.$setOnInsert });
            upsertedCount += 1;
          }
        }
        return { upsertedCount };
      }
    },
    monthlyFinalization: {
      find(query) {
        return makeCursor(state.finalizedMonths
          .filter(record => query.month.$in.includes(record.month)));
      }
    }
  };
};

const schedule = (day, availableMeals, month = '2026-09') => ({
  date: new Date(`${day}T00:00:00.000Z`),
  month,
  availableMeals
});

const meal = (mealType, options = {}) => ({
  mealType,
  isAvailable: true,
  ...options
});

test('uses the current Asia/Dhaka calendar date as the schedule query boundary', () => {
  const justAfterDhakaMidnight = new Date('2026-09-16T18:05:00.000Z');
  assert.equal(
    getDhakaTodayStartDate(justAfterDhakaMidnight).toISOString(),
    '2026-09-17T00:00:00.000Z'
  );
});

test('selects open meals today and later, skipping unavailable, expired, existing, and finalized meals', () => {
  const now = new Date('2026-09-17T02:00:00.000Z');
  const today = schedule('2026-09-17', [
    meal('morning'), // The default morning deadline has passed.
    meal('evening'), // The deadline is exactly now and is still open.
    meal('night'),
    { mealType: 'night-custom', isAvailable: true, customDeadline: '2026-09-17T01:59:00.000Z' },
    meal('evening', { isAvailable: false })
  ]);

  const future = schedule('2026-09-18', [
    meal('evening', { customDeadline: '2026-09-17T04:00:00.000Z' }),
    meal('night')
  ]);
  const finalized = schedule('2026-10-01', [meal('night')], '2026-10');
  const candidates = getMealDefaultRegistrationCandidates({
    schedules: [today, future, finalized],
    existingRegistrations: [{
      userId: 'user-1',
      date: today.date,
      mealType: 'night'
    }],
    finalizedMonths: new Set(['2026-10']),
    userId: 'user-1',
    currentTime: now
  });

  assert.deepEqual(
    candidates.map(candidate => `${candidate.date.toISOString()}_${candidate.mealType}`),
    [
      '2026-09-17T00:00:00.000Z_evening',
      '2026-09-18T00:00:00.000Z_evening',
      '2026-09-18T00:00:00.000Z_night'
    ]
  );
});

test('backfill preserves existing registration details and creates only missing registrations', async () => {
  const now = new Date('2026-09-17T01:00:00.000Z');
  const today = schedule('2026-09-17', [meal('night')]);
  const existing = {
    userId: 'user-1',
    date: today.date,
    mealType: 'night',
    numberOfMeals: 3,
    comment: 'Keep my note'
  };
  const collections = makeCollections({
    schedules: [today, schedule('2026-09-18', [meal('night')])],
    registrations: [existing]
  });

  const count = await createMealDefaultRegistrations({
    userId: 'user-1',
    ...collections,
    now
  });

  assert.equal(count, 1);
  assert.equal(collections.state.registrations.length, 2);
  assert.deepEqual(collections.state.registrations[0], existing);
  assert.equal(collections.state.registrations[1].numberOfMeals, 1);
});

test('repeating an eligible backfill does not duplicate registrations', async () => {
  const collections = makeCollections({
    schedules: [schedule('2026-09-17', [meal('night')])]
  });
  const args = { userId: 'user-1', ...collections, now: new Date('2026-09-17T01:00:00.000Z') };

  assert.equal(await createMealDefaultRegistrations(args), 1);
  assert.equal(await createMealDefaultRegistrations(args), 0);
  assert.equal(collections.state.registrations.length, 1);
});

test('duplicate-key races retry safely and report successful upserts', async () => {
  const collections = makeCollections({
    schedules: [schedule('2026-09-17', [meal('night')])]
  });
  const originalBulkWrite = collections.mealRegistrations.bulkWrite.bind(collections.mealRegistrations);
  let firstCall = true;
  collections.mealRegistrations.bulkWrite = async operations => {
    if (firstCall) {
      firstCall = false;
      await originalBulkWrite(operations);
      const error = new Error('duplicate key');
      error.code = 11000;
      error.upsertedCount = 1;
      throw error;
    }
    return originalBulkWrite(operations);
  };

  const count = await createMealDefaultRegistrations({
    userId: 'user-1',
    ...collections,
    now: new Date('2026-09-17T01:00:00.000Z')
  });

  assert.equal(count, 1);
  assert.equal(collections.state.registrations.length, 1);
});

test('turning auto-register off preserves registrations and does not scan schedules', async () => {
  const existing = {
    userId: 'user-1',
    date: new Date('2026-09-18T00:00:00.000Z'),
    mealType: 'night',
    numberOfMeals: 2
  };
  const collections = makeCollections({
    schedules: [schedule('2026-09-18', [meal('night')])],
    registrations: [existing]
  });
  collections.state.user = { _id: 'user-1', mealDefault: true };

  const result = await applyMealDefaultPreference({
    user: collections.state.user,
    mealDefault: false,
    ...collections,
    now: new Date('2026-09-17T01:00:00.000Z')
  });

  assert.equal(result.registeredCount, 0);
  assert.equal(collections.state.user.mealDefault, false);
  assert.equal(collections.state.scheduleQueries, 0);
  assert.deepEqual(collections.state.registrations, [existing]);
});

test('a newly enabled user is backfilled, while an already-enabled preference is not replayed', async () => {
  const collections = makeCollections({
    schedules: [schedule('2026-09-17', [meal('night')])]
  });
  collections.state.user = { _id: 'user-1', mealDefault: false };
  const args = {
    user: collections.state.user,
    mealDefault: true,
    ...collections,
    now: new Date('2026-09-17T01:00:00.000Z')
  };

  assert.equal((await applyMealDefaultPreference(args)).registeredCount, 1);
  assert.equal(collections.state.user.mealDefault, true);
  assert.equal((await applyMealDefaultPreference({ ...args, user: collections.state.user })).registeredCount, 0);
  assert.equal(collections.state.registrations.length, 1);
});
