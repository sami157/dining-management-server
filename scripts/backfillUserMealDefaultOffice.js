const { getCollections } = require('../config/connectMongodb');

async function backfillUserMealDefaultOffice() {
  const { users } = await getCollections();

  const result = await users.updateMany(
    { mealDefaultOffice: { $exists: false } },
    { $set: { mealDefaultOffice: false, updatedAt: new Date() } }
  );

  console.log(`Matched ${result.matchedCount} users`);
  console.log(`Modified ${result.modifiedCount} users`);
}

backfillUserMealDefaultOffice()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to backfill mealDefaultOffice on users:', error);
    process.exit(1);
  });
