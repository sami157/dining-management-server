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
const isDryRun = !process.argv.includes('--execute');

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

const plans = [
  {
    collection: 'mealSchedules',
    derive(doc) {
      return {
        serviceDate: doc.serviceDate || formatDhakaDate(doc.date)
      };
    }
  },
  {
    collection: 'mealRegistrations',
    derive(doc) {
      return {
        serviceDate: doc.serviceDate || formatDhakaDate(doc.date)
      };
    }
  },
  {
    collection: 'expenses',
    derive(doc) {
      return {
        serviceDate: doc.serviceDate || formatDhakaDate(doc.date),
        createdDate: doc.createdDate || formatDhakaDate(doc.createdAt),
        updatedDate: doc.updatedDate || formatDhakaDate(doc.updatedAt)
      };
    }
  },
  {
    collection: 'deposits',
    derive(doc) {
      return {
        serviceDate: doc.serviceDate || formatDhakaDate(doc.depositDate),
        createdDate: doc.createdDate || formatDhakaDate(doc.createdAt)
      };
    }
  },
  {
    collection: 'monthlyFinalization',
    derive(doc) {
      return {
        finalizedDate: doc.finalizedDate || formatDhakaDate(doc.finalizedAt)
      };
    }
  }
];

const hasMissingDerivedField = (doc, derived) => {
  return Object.entries(derived).some(([key, value]) => value && !doc[key]);
};

async function processCollection(db, plan) {
  const collection = db.collection(plan.collection);
  const docs = await collection.find({}).toArray();

  let scanned = 0;
  let wouldUpdate = 0;
  let updated = 0;
  const operations = [];

  for (const doc of docs) {
    scanned += 1;
    const derived = plan.derive(doc);

    if (!hasMissingDerivedField(doc, derived)) {
      continue;
    }

    const $set = {};
    for (const [key, value] of Object.entries(derived)) {
      if (value && !doc[key]) {
        $set[key] = value;
      }
    }

    if (Object.keys($set).length === 0) {
      continue;
    }

    wouldUpdate += 1;
    operations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set }
      }
    });
  }

  if (!isDryRun && operations.length > 0) {
    const result = await collection.bulkWrite(operations, { ordered: false });
    updated = result.modifiedCount;
  }

  return {
    scanned,
    wouldUpdate,
    updated,
    mode: isDryRun ? 'dry-run' : 'execute'
  };
}

async function main() {
  await client.connect();
  const db = client.db(dbName);

  const report = {
    mode: isDryRun ? 'dry-run' : 'execute',
    timezone: BUSINESS_TIMEZONE,
    processedAt: new Date().toISOString(),
    collections: {}
  };

  for (const plan of plans) {
    report.collections[plan.collection] = await processCollection(db, plan);
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
