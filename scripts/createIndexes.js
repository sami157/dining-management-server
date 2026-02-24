const { connectMongoDB, mealRegistrations, mealSchedules, deposits, memberBalances, monthlyFinalization } = require('../config/connectMongodb');

async function createIndexes() {
  await connectMongoDB();

  await mealRegistrations.createIndex({ userId: 1, date: 1 });
  await mealRegistrations.createIndex({ date: 1 });
  await mealSchedules.createIndex({ date: 1 });
  await deposits.createIndex({ month: 1 });
  await memberBalances.createIndex({ userId: 1 });
  await monthlyFinalization.createIndex({ month: 1 });

  console.log('All indexes created successfully');
  process.exit(0);
}

createIndexes().catch(console.error);