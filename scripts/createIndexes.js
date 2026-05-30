const { connectMongoDB, getCollections } = require('../config/connectMongodb');

const sameKey = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const args = new Set(process.argv.slice(2));

async function ensureIndex(label, collection, key, options = {}) {
  const indexes = await collection.indexes();
  const existing = indexes.find(index => sameKey(index.key, key) && !!index.unique === !!options.unique);

  if (existing) {
    console.log(`Skipping ${label}: already exists as ${existing.name}`);
    return;
  }

  console.log(`Creating ${label}...`);
  await collection.createIndex(key, options);
  console.log(`Created ${label}`);
}

async function ensureUniqueIndex(label, collection, key, options = {}) {
  const indexes = await collection.indexes();
  const existing = indexes.find(index => sameKey(index.key, key));

  if (existing?.unique) {
    console.log(`Skipping ${label}: already exists as ${existing.name}`);
    return;
  }

  if (existing) {
    console.log(`Dropping non-unique ${existing.name} before creating ${label}...`);
    await collection.dropIndex(existing.name);
    console.log(`Dropped ${existing.name}`);
  }

  console.log(`Creating ${label}...`);
  await collection.createIndex(key, { ...options, unique: true });
  console.log(`Created ${label}`);
}

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

  if (!args.has('--critical-only')) {
    await ensureIndex('users.email', users, { email: 1 });
    await ensureIndex('users.isActive', users, { isActive: 1 });
  }

  await ensureUniqueIndex(
    'mealRegistrations.userId+date+mealType unique',
    mealRegistrations,
    { userId: 1, date: 1, mealType: 1 },
    { name: 'uniq_mealRegistrations_userId_date_mealType' }
  );

  if (!args.has('--critical-only')) {
    await ensureIndex('mealRegistrations.date', mealRegistrations, { date: 1 });
  }

  await ensureUniqueIndex(
    'mealSchedules.date unique',
    mealSchedules,
    { date: 1 },
    { name: 'uniq_mealSchedules_date' }
  );

  if (!args.has('--critical-only')) {
    await ensureIndex('deposits.month', deposits, { month: 1 });
    await ensureUniqueIndex('memberBalances.userId unique', memberBalances, { userId: 1 });
    await ensureUniqueIndex('monthlyFinalization.month unique', monthlyFinalization, { month: 1 });
    await ensureIndex('passwordRecoveryCodes.userId+used+expiresAt', passwordRecoveryCodes, { userId: 1, used: 1, expiresAt: 1 });
    await ensureIndex('passwordRecoveryCodes.expiresAt TTL', passwordRecoveryCodes, { expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  console.log('All indexes created successfully');
  process.exit(0);
}

createIndexes().catch(console.error);
