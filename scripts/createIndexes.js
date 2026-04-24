const { connectMongoDB, getCollections } = require('../config/connectMongodb');

async function createIndexes() {
  await connectMongoDB();
  const {
    users,
    mealRegistrations,
    mealSchedules,
    deposits,
    memberBalances,
    monthlyFinalization,
    passwordRecoveryCodes,
  } = await getCollections();

  await users.createIndex({ email: 1 });
  await users.createIndex({ isActive: 1 });
  await mealRegistrations.createIndex({ userId: 1, date: 1 });
  await mealRegistrations.createIndex({ date: 1 });
  await mealSchedules.createIndex({ date: 1 });
  await deposits.createIndex({ month: 1 });
  await memberBalances.createIndex({ userId: 1 });
  await monthlyFinalization.createIndex({ month: 1 });
  await passwordRecoveryCodes.createIndex({ userId: 1, used: 1, expiresAt: 1 });
  await passwordRecoveryCodes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  console.log('All indexes created successfully');
  process.exit(0);
}

createIndexes().catch(console.error);
