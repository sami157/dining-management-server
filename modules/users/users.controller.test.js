const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const Module = require('node:module');

const controllerPath = require.resolve('./users.controller');

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  }
});

const loadRegisterMealWithCollections = collections => {
  const originalLoad = Module._load;
  const connectMongodbPath = '../../config/connectMongodb';

  Module._load = function load(request, parent, isMain) {
    if (request === connectMongodbPath && parent?.filename === controllerPath) {
      return {
        getCollections: async () => collections,
        getMongoClient: async () => ({
          startSession: () => ({
            withTransaction: async callback => callback(),
            endSession: async () => {}
          })
        })
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[controllerPath];

  try {
    return require('./users.controller').registerMeal;
  } finally {
    Module._load = originalLoad;
    delete require.cache[controllerPath];
  }
};

test('registers a meal for another user when requested by an admin', async () => {
  const adminId = new ObjectId('000000000000000000000001');
  const targetUserId = new ObjectId('000000000000000000000002');
  const registrationId = new ObjectId('000000000000000000000003');
  const mealDate = new Date('2099-09-25T00:00:00.000Z');
  const adminUser = {
    _id: adminId,
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin'
  };
  const targetUser = {
    _id: targetUserId,
    name: 'Target User',
    email: 'target@example.com',
    role: 'member'
  };
  const calls = {
    targetUserQueries: [],
    registrationQueries: [],
    insertedRegistration: null,
    activityLogs: []
  };

  const collections = {
    users: {
      async findOne(query) {
        calls.targetUserQueries.push(query);
        return query._id.equals(targetUserId) ? targetUser : null;
      }
    },
    mealSchedules: {
      async findOne(query) {
        assert.equal(query.date.getTime(), mealDate.getTime());
        return {
          date: mealDate,
          availableMeals: [{ mealType: 'night', isAvailable: true }]
        };
      }
    },
    mealRegistrations: {
      async findOne(query) {
        calls.registrationQueries.push(query);
        return null;
      },
      async insertOne(registration, options) {
        calls.insertedRegistration = { registration, options };
        return { insertedId: registrationId };
      }
    },
    systemLogs: {
      async insertMany(logs, options) {
        calls.activityLogs.push({ logs, options });
      }
    },
    monthlyFinalization: {
      async findOne() {
        return null;
      }
    }
  };

  const registerMeal = loadRegisterMealWithCollections(collections);
  const req = {
    user: adminUser,
    body: {
      userId: targetUserId.toString(),
      date: mealDate.toISOString(),
      mealType: 'night',
      numberOfMeals: 2,
      comment: 'Admin registration'
    }
  };
  const res = createResponse();

  await registerMeal(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.message, 'Meal registered successfully');
  assert.equal(calls.targetUserQueries.length, 1);
  assert(calls.targetUserQueries[0]._id.equals(targetUserId));
  assert.equal(calls.registrationQueries[0].userId.toString(), targetUserId.toString());
  assert.equal(calls.insertedRegistration.registration.userId.toString(), targetUserId.toString());
  assert.equal(calls.insertedRegistration.registration.numberOfMeals, 2);
  assert.equal(calls.insertedRegistration.options.session !== undefined, true);
  assert.equal(calls.activityLogs.length, 1);
  assert.equal(calls.activityLogs[0].logs[0].targetUserId.toString(), targetUserId.toString());
  assert.equal(calls.activityLogs[0].logs[0].actorUserId.toString(), adminId.toString());
  assert.equal(calls.activityLogs[0].logs[0].source, 'other_user');
});

test('registers a meal for the authenticated user without a target lookup', async () => {
  const memberId = new ObjectId('000000000000000000000011');
  const registrationId = new ObjectId('000000000000000000000012');
  const mealDate = new Date('2099-09-26T00:00:00.000Z');
  const memberUser = {
    _id: memberId,
    name: 'Member User',
    email: 'member@example.com',
    role: 'member'
  };
  const calls = {
    targetUserLookups: 0,
    insertedRegistration: null,
    activityLogs: []
  };

  const collections = {
    users: {
      async findOne() {
        calls.targetUserLookups += 1;
        throw new Error('Self-registration should not query users');
      }
    },
    mealSchedules: {
      async findOne(query) {
        assert.equal(query.date.getTime(), mealDate.getTime());
        return {
          date: mealDate,
          availableMeals: [{ mealType: 'night', isAvailable: true }]
        };
      }
    },
    mealRegistrations: {
      async findOne() {
        return null;
      },
      async insertOne(registration, options) {
        calls.insertedRegistration = { registration, options };
        return { insertedId: registrationId };
      }
    },
    systemLogs: {
      async insertMany(logs, options) {
        calls.activityLogs.push({ logs, options });
      }
    },
    monthlyFinalization: {
      async findOne() {
        return null;
      }
    }
  };

  const registerMeal = loadRegisterMealWithCollections(collections);
  const req = {
    user: memberUser,
    body: {
      date: mealDate.toISOString(),
      mealType: 'night'
    }
  };
  const res = createResponse();

  await registerMeal(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(calls.targetUserLookups, 0);
  assert.equal(calls.insertedRegistration.registration.userId.toString(), memberId.toString());
  assert.equal(calls.insertedRegistration.options.session !== undefined, true);
  assert.equal(calls.activityLogs[0].logs[0].source, 'self');
});
