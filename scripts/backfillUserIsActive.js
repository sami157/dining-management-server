const { getCollections } = require('../config/connectMongodb');

async function backfillUserIsActive() {
  const { users } = await getCollections();

  const result = await users.updateMany(
    { isActive: { $exists: false } },
    { $set: { isActive: true, updatedAt: new Date() } }
  );

  console.log(`Matched ${result.matchedCount} users`);
  console.log(`Modified ${result.modifiedCount} users`);
}

backfillUserIsActive()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to backfill isActive on users:', error);
    process.exit(1);
  });
