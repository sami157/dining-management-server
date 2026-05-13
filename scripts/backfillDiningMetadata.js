const { getCollections } = require('../config/connectMongodb');

async function backfillDiningMetadata() {
  const { users, mealRegistrations, mealSchedules, expenses } = await getCollections();

  const usersResult = await users.updateMany(
    { mealDefaultOffice: { $exists: false } },
    { $set: { mealDefaultOffice: false, updatedAt: new Date() } }
  );

  const registrationsResult = await mealRegistrations.updateMany(
    { diningId: { $exists: false } },
    { $set: { diningId: 'township' } }
  );

  const expensesResult = await expenses.updateMany(
    { diningId: { $exists: false } },
    { $set: { diningId: 'township', updatedAt: new Date() } }
  );

  const schedules = await mealSchedules.find({
    availableMeals: {
      $elemMatch: {
        diningId: { $exists: false }
      }
    }
  }).toArray();

  let schedulesModified = 0;

  for (const schedule of schedules) {
    const availableMeals = (schedule.availableMeals || []).map((meal) => ({
      ...meal,
      diningId: meal.diningId || 'township'
    }));

    const result = await mealSchedules.updateOne(
      { _id: schedule._id },
      { $set: { availableMeals, updatedAt: new Date() } }
    );

    schedulesModified += result.modifiedCount;
  }

  console.log(JSON.stringify({
    users: {
      matched: usersResult.matchedCount,
      modified: usersResult.modifiedCount
    },
    mealRegistrations: {
      matched: registrationsResult.matchedCount,
      modified: registrationsResult.modifiedCount
    },
    expenses: {
      matched: expensesResult.matchedCount,
      modified: expensesResult.modifiedCount
    },
    mealSchedules: {
      matched: schedules.length,
      modified: schedulesModified
    }
  }, null, 2));
}

backfillDiningMetadata()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to backfill dining metadata:', error);
    process.exit(1);
  });
