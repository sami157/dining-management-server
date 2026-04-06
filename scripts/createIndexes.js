require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI is required');
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  },
  maxIdleTimeMS: 10000,
  serverSelectionTimeoutMS: 10000
});

const dbName = 'diningManagementDB';

const indexPlans = [
  {
    collection: 'users',
    indexes: [
      {
        key: { email: 1 },
        options: {
          unique: true,
          name: 'email_1',
          partialFilterExpression: { email: { $type: 'string' } }
        }
      }
    ]
  },
  {
    collection: 'mealSchedules',
    indexes: [
      {
        key: { serviceDate: 1 },
        options: {
          unique: true,
          name: 'serviceDate_1',
          partialFilterExpression: { serviceDate: { $exists: true } }
        }
      }
    ]
  },
  {
    collection: 'mealRegistrations',
    indexes: [
      {
        key: { userId: 1, serviceDate: 1, mealType: 1 },
        options: {
          unique: true,
          name: 'userId_1_serviceDate_1_mealType_1',
          partialFilterExpression: {
            userId: { $exists: true },
            serviceDate: { $exists: true },
            mealType: { $exists: true }
          }
        }
      },
      {
        key: { serviceDate: 1 },
        options: { name: 'serviceDate_1' }
      }
    ]
  },
  {
    collection: 'expenses',
    indexes: [
      {
        key: { serviceDate: 1 },
        options: {
          name: 'serviceDate_1',
          partialFilterExpression: { serviceDate: { $exists: true } }
        }
      }
    ]
  },
  {
    collection: 'deposits',
    indexes: [
      {
        key: { month: 1 },
        options: { name: 'month_1' }
      },
      {
        key: { userId: 1, month: 1 },
        options: { name: 'userId_1_month_1' }
      },
      {
        key: { serviceDate: 1 },
        options: {
          name: 'serviceDate_1',
          partialFilterExpression: { serviceDate: { $exists: true } }
        }
      }
    ]
  },
  {
    collection: 'memberBalances',
    indexes: [
      {
        key: { userId: 1 },
        options: {
          unique: true,
          name: 'userId_1',
          partialFilterExpression: { userId: { $exists: true } }
        }
      }
    ]
  },
  {
    collection: 'monthlyFinalization',
    indexes: [
      {
        key: { month: 1 },
        options: {
          unique: true,
          name: 'month_1',
          partialFilterExpression: { month: { $exists: true } }
        }
      },
      {
        key: { finalizedDate: 1 },
        options: {
          name: 'finalizedDate_1',
          partialFilterExpression: { finalizedDate: { $exists: true } }
        }
      }
    ]
  }
];

async function createIndexes() {
  await client.connect();
  const db = client.db(dbName);
  const results = {};

  for (const plan of indexPlans) {
    const collection = db.collection(plan.collection);
    results[plan.collection] = [];
    const existingIndexes = await collection.indexes();

    for (const index of plan.indexes) {
      const currentIndex = existingIndexes.find((item) => item.name === index.options.name);

      if (currentIndex) {
        const currentIsUnique = Boolean(currentIndex.unique);
        const desiredIsUnique = Boolean(index.options.unique);

        if (currentIsUnique !== desiredIsUnique) {
          await collection.dropIndex(currentIndex.name);
          results[plan.collection].push(`dropped:${currentIndex.name}`);
        }
      }

      const createdName = await collection.createIndex(index.key, index.options);
      results[plan.collection].push(createdName);
    }
  }

  console.log(JSON.stringify({ database: dbName, indexes: results }, null, 2));
}

createIndexes()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.close();
  });
