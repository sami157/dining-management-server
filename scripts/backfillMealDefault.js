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
const isDryRun = !process.argv.includes('--execute');

async function main() {
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection('users');

  const filter = { mealDefault: { $exists: false } };
  const missingCount = await users.countDocuments(filter);

  const report = {
    mode: isDryRun ? 'dry-run' : 'execute',
    processedAt: new Date().toISOString(),
    collection: 'users',
    filter,
    wouldUpdate: missingCount,
    updated: 0
  };

  if (!isDryRun && missingCount > 0) {
    const result = await users.updateMany(filter, {
      $set: {
        mealDefault: false,
        updatedAt: new Date()
      }
    });

    report.updated = result.modifiedCount;
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
