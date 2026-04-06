require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const { DateTime } = require('luxon');

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
const BUSINESS_TIMEZONE = 'Asia/Dhaka';

const formatDhakaDate = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) {
    return value;
  }

  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(BUSINESS_TIMEZONE).toFormat('yyyy-LL-dd');
  }

  const parsed = DateTime.fromISO(String(value), { zone: 'utc' }).setZone(BUSINESS_TIMEZONE);
  return parsed.isValid ? parsed.toFormat('yyyy-LL-dd') : null;
};

const stringifyValue = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === 'object' && value._bsontype === 'ObjectId') {
    return value.toString();
  }

  return value;
};

const auditPlans = [
  {
    collection: 'mealSchedules',
    canonicalFields: ['serviceDate'],
    projection: { date: 1, serviceDate: 1 },
    derive(doc) {
      return {
        serviceDate: doc.serviceDate || formatDhakaDate(doc.date)
      };
    },
    sampleSort: { date: -1 }
  },
  {
    collection: 'mealRegistrations',
    canonicalFields: ['serviceDate'],
    projection: { userId: 1, date: 1, serviceDate: 1, mealType: 1, registeredAt: 1 },
    derive(doc) {
      return {
        serviceDate: doc.serviceDate || formatDhakaDate(doc.date)
      };
    },
    sampleSort: { date: -1, registeredAt: -1 }
  },
  {
    collection: 'expenses',
    canonicalFields: ['serviceDate', 'createdDate', 'updatedDate'],
    projection: { date: 1, serviceDate: 1, createdAt: 1, createdDate: 1, updatedAt: 1, updatedDate: 1, category: 1, amount: 1 },
    derive(doc) {
      return {
        serviceDate: doc.serviceDate || formatDhakaDate(doc.date),
        createdDate: doc.createdDate || formatDhakaDate(doc.createdAt),
        updatedDate: doc.updatedDate || formatDhakaDate(doc.updatedAt)
      };
    },
    sampleSort: { date: -1, createdAt: -1 }
  },
  {
    collection: 'deposits',
    canonicalFields: ['serviceDate', 'createdDate'],
    projection: { month: 1, depositDate: 1, serviceDate: 1, createdAt: 1, createdDate: 1, amount: 1, userId: 1 },
    derive(doc) {
      return {
        serviceDate: doc.serviceDate || formatDhakaDate(doc.depositDate),
        createdDate: doc.createdDate || formatDhakaDate(doc.createdAt)
      };
    },
    sampleSort: { depositDate: -1, createdAt: -1 }
  },
  {
    collection: 'monthlyFinalization',
    canonicalFields: ['finalizedDate'],
    projection: { month: 1, finalizedAt: 1, finalizedDate: 1, mealRate: 1, totalMealsServed: 1, totalExpenses: 1 },
    derive(doc) {
      return {
        finalizedDate: doc.finalizedDate || formatDhakaDate(doc.finalizedAt)
      };
    },
    sampleSort: { month: -1 }
  }
];

async function auditCollection(db, plan) {
  const collection = db.collection(plan.collection);
  const total = await collection.countDocuments();

  const missingFilter = {
    $or: plan.canonicalFields.map((field) => ({
      [field]: { $exists: false }
    }))
  };

  const missingCount = await collection.countDocuments(missingFilter);
  const sampleDocs = await collection.find(missingFilter, { projection: plan.projection }).sort(plan.sampleSort).limit(5).toArray();

  return {
    total,
    missingCanonicalFields: missingCount,
    canonicalFields: plan.canonicalFields,
    samples: sampleDocs.map((doc) => ({
      _id: stringifyValue(doc._id),
      stored: Object.fromEntries(
        Object.entries(doc)
          .filter(([key]) => key !== '_id')
          .map(([key, value]) => [key, stringifyValue(value)])
      ),
      derived: plan.derive(doc)
    }))
  };
}

async function main() {
  await client.connect();
  const db = client.db(dbName);

  const report = {
    timezone: BUSINESS_TIMEZONE,
    auditedAt: new Date().toISOString(),
    collections: {}
  };

  for (const plan of auditPlans) {
    report.collections[plan.collection] = await auditCollection(db, plan);
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.close();
  });
