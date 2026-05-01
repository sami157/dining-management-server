const dns = require('dns');
const { ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const { getCollections } = require('../config/connectMongodb');

dns.setServers(['8.8.8.8']);
dotenv.config({ path: '.env.local' });

const args = new Set(process.argv.slice(2));
const getArg = (name, fallback) => {
  const prefix = `${name}=`;
  const arg = process.argv.slice(2).find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
};

const month = getArg('--month', '2026-04');
const from = getArg('--from', `${month}-26`);
const to = getArg('--to', `${month}-30`);
const apply = args.has('--apply');

const toDay = date => date.toISOString().slice(0, 10);
const roundHalfUnits = value => Math.round(value * 2);

const findCombination = (targetHalfUnits, slots) => {
  const maxCount = Math.ceil(targetHalfUnits / Math.min(...slots.map(slot => slot.weightHalfUnits))) + 5;
  const result = [];

  const search = (index, remaining) => {
    if (remaining === 0) return true;
    if (index >= slots.length) return false;

    const slot = slots[index];
    const maxForSlot = Math.min(maxCount, Math.floor(remaining / slot.weightHalfUnits));

    for (let count = maxForSlot; count >= 0; count -= 1) {
      result[index] = count;
      if (search(index + 1, remaining - count * slot.weightHalfUnits)) {
        return true;
      }
    }

    result[index] = 0;
    return false;
  };

  if (!search(0, targetHalfUnits)) return null;

  return slots
    .map((slot, index) => ({ ...slot, numberOfMeals: result[index] || 0 }))
    .filter(slot => slot.numberOfMeals > 0);
};

const main = async () => {
  const { mealRegistrations, mealSchedules, monthlyFinalization } = await getCollections();

  const [year, monthNumber] = month.split('-').map(Number);
  const monthStart = new Date(year, monthNumber - 1, 1);
  const monthEnd = new Date(year, monthNumber, 0, 23, 59, 59, 999);
  const backfillStart = new Date(`${from}T00:00:00.000Z`);
  const backfillEnd = new Date(`${to}T23:59:59.999Z`);

  const [finalization, registrations, schedules, backfillRegistrations] = await Promise.all([
    monthlyFinalization.findOne({ month }),
    mealRegistrations.find({ date: { $gte: monthStart, $lte: monthEnd } }).toArray(),
    mealSchedules.find({ date: { $gte: monthStart, $lte: monthEnd } }).sort({ date: 1 }).toArray(),
    mealRegistrations.find({ date: { $gte: backfillStart, $lte: backfillEnd } }).toArray(),
  ]);

  if (!finalization) {
    throw new Error(`No monthlyFinalization record found for ${month}`);
  }

  if (backfillRegistrations.length > 0 && !args.has('--allow-existing-range')) {
    throw new Error(
      `${from}..${to} already has ${backfillRegistrations.length} registrations. ` +
      'Refusing to backfill unless --allow-existing-range is passed.'
    );
  }

  const scheduleMap = new Map(schedules.map(schedule => [schedule.date.toISOString(), schedule]));
  const currentByUser = new Map();

  for (const registration of registrations) {
    const userId = registration.userId?.toString();
    const schedule = scheduleMap.get(registration.date.toISOString());
    const meal = schedule?.availableMeals?.find(item => item.mealType === registration.mealType);
    const weight = meal?.weight || 1;
    const numberOfMeals = registration.numberOfMeals || 1;
    currentByUser.set(userId, (currentByUser.get(userId) || 0) + numberOfMeals * weight);
  }

  const slots = schedules
    .filter(schedule => schedule.date >= backfillStart && schedule.date <= backfillEnd)
    .flatMap(schedule => schedule.availableMeals
      .filter(meal => meal.isAvailable && meal.weight > 0)
      .map(meal => ({
        date: schedule.date,
        mealType: meal.mealType,
        weight: meal.weight,
        weightHalfUnits: roundHalfUnits(meal.weight),
      })));

  if (slots.length === 0) {
    throw new Error(`No available meal slots found for ${from}..${to}`);
  }

  const docs = [];
  const unresolved = [];

  for (const member of finalization.memberDetails || []) {
    const target = Number(member.totalMeals) || 0;
    const current = currentByUser.get(member.userId) || 0;
    const gap = target - current;

    if (Math.abs(gap) < 0.000001) continue;
    if (gap < 0) {
      unresolved.push({ userId: member.userId, userName: member.userName, target, current, gap });
      continue;
    }

    const combination = findCombination(roundHalfUnits(gap), slots);
    if (!combination) {
      unresolved.push({ userId: member.userId, userName: member.userName, target, current, gap });
      continue;
    }

    for (const item of combination) {
      docs.push({
        userId: new ObjectId(member.userId),
        date: item.date,
        mealType: item.mealType,
        numberOfMeals: item.numberOfMeals,
        registeredAt: finalization.finalizedAt || new Date(),
        backfilled: true,
        backfilledAt: new Date(),
        backfillReason: `Restore ${month} registrations from finalized member totals`,
        sourceFinalizationId: finalization._id,
      });
    }
  }

  const plannedTotal = docs.reduce((sum, doc) => {
    const slot = slots.find(item => item.date.getTime() === doc.date.getTime() && item.mealType === doc.mealType);
    return sum + doc.numberOfMeals * slot.weight;
  }, 0);

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    month,
    backfillRange: { from, to },
    finalizedTotal: finalization.totalMealsServed,
    currentTotal: Array.from(currentByUser.values()).reduce((sum, value) => sum + value, 0),
    plannedBackfillTotal: plannedTotal,
    plannedInsertCount: docs.length,
    unresolvedCount: unresolved.length,
    unresolved,
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log('Dry run only. Re-run with --apply to insert these backfill registrations.');
    return;
  }

  if (unresolved.length > 0) {
    throw new Error('Refusing to apply because some member gaps could not be resolved.');
  }

  if (docs.length > 0) {
    await mealRegistrations.insertMany(docs, { ordered: false });
  }

  console.log(JSON.stringify({ ...summary, insertedCount: docs.length }, null, 2));
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
