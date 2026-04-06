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

const collectionPlans = [
  {
    name: 'mealSchedules',
    limit: 5,
    sort: { date: -1 },
    projection: { date: 1, isHoliday: 1, availableMeals: 1 }
  },
  {
    name: 'mealRegistrations',
    limit: 5,
    sort: { date: -1, registeredAt: -1 },
    projection: { userId: 1, date: 1, mealType: 1, numberOfMeals: 1, registeredAt: 1 }
  },
  {
    name: 'expenses',
    limit: 5,
    sort: { date: -1, createdAt: -1 },
    projection: { date: 1, category: 1, amount: 1, createdAt: 1, updatedAt: 1 }
  },
  {
    name: 'deposits',
    limit: 5,
    sort: { depositDate: -1, createdAt: -1 },
    projection: { userId: 1, month: 1, depositDate: 1, createdAt: 1, amount: 1 }
  },
  {
    name: 'monthlyFinalization',
    limit: 5,
    sort: { month: -1 },
    projection: { month: 1, finalizedAt: 1, mealRate: 1, totalMealsServed: 1, totalExpenses: 1 }
  },
  {
    name: 'mealDeadlines',
    limit: 2,
    sort: { updatedAt: -1 },
    projection: { key: 1, morning: 1, evening: 1, night: 1, updatedAt: 1, updatedBy: 1 }
  }
];

const replacer = (_key, value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === 'object' && value._bsontype === 'ObjectId') {
    return value.toString();
  }

  return value;
};

async function main() {
  await client.connect();
  const db = client.db(dbName);

  const result = {};

  for (const plan of collectionPlans) {
    const docs = await db
      .collection(plan.name)
      .find({}, { projection: plan.projection })
      .sort(plan.sort)
      .limit(plan.limit)
      .toArray();

    result[plan.name] = docs;
  }

  console.log(JSON.stringify(result, replacer, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.close();
  });
