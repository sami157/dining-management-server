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

const dateDistribution = {
  '2026-04-26': 0.28,
  '2026-04-27': 0.28,
  '2026-04-28': 0.26,
  '2026-04-29': 0.09,
  '2026-04-30': 0.09,
};

const mealCountDistribution = {
  1: 0.7,
  2: 0.25,
  3: 0.05,
};

const findCombination = (targetHalfUnits, slots, runningDateHalfUnits, projectedTotalHalfUnits) => {
  const maxMealsPerRegistration = 3;
  const result = [];
  let best = null;
  let bestScore = Infinity;

  const scoreCombination = combination => {
    const projectedByDate = new Map(runningDateHalfUnits);

    for (const slot of combination) {
      const dateKey = toDay(slot.date);
      projectedByDate.set(
        dateKey,
        (projectedByDate.get(dateKey) || 0) + slot.numberOfMeals * slot.weightHalfUnits
      );
    }

    let score = 0;

    for (const slot of slots) {
      const dateKey = toDay(slot.date);
      const targetShare = dateDistribution[dateKey] || (1 / slots.length);
      const expected = projectedTotalHalfUnits * targetShare;
      const actual = projectedByDate.get(dateKey) || 0;
      score += Math.abs(actual - expected);
    }

    // Keep later dates present, but comparatively lighter than the earlier dates.
    for (const slot of combination) {
      const dateKey = toDay(slot.date);
      if (dateKey === '2026-04-29' || dateKey === '2026-04-30') {
        score += slot.numberOfMeals * slot.weightHalfUnits * 0.2;
      }
    }

    const combinationCounts = combination.reduce((counts, slot) => {
      counts[slot.numberOfMeals] = (counts[slot.numberOfMeals] || 0) + 1;
      return counts;
    }, {});
    const totalCombinationDocs = combination.length || 1;

    for (const [count, targetShare] of Object.entries(mealCountDistribution)) {
      const actualShare = (combinationCounts[count] || 0) / totalCombinationDocs;
      score += Math.abs(actualShare - targetShare) * 4;
    }

    for (const slot of combination) {
      if (slot.numberOfMeals === 2) score += 0.15;
      if (slot.numberOfMeals === 3) score += 0.45;
    }

    return score;
  };

  const search = (index, remaining) => {
    if (remaining === 0) {
      const combination = slots
        .map((slot, slotIndex) => ({ ...slot, numberOfMeals: result[slotIndex] || 0 }))
        .filter(slot => slot.numberOfMeals > 0);
      const score = scoreCombination(combination);

      if (score < bestScore) {
        bestScore = score;
        best = combination;
      }

      return;
    }
    if (index >= slots.length) return false;

    const slot = slots[index];
    const maxForSlot = Math.min(maxMealsPerRegistration, Math.floor(remaining / slot.weightHalfUnits));

    for (let count = maxForSlot; count >= 0; count -= 1) {
      result[index] = count;
      search(index + 1, remaining - count * slot.weightHalfUnits);
    }

    result[index] = 0;
  };

  search(0, targetHalfUnits);
  return best;
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
  const runningDateHalfUnits = new Map(slots.map(slot => [toDay(slot.date), 0]));
  const totalGapHalfUnits = (finalization.memberDetails || []).reduce((sum, member) => {
    const target = Number(member.totalMeals) || 0;
    const current = currentByUser.get(member.userId) || 0;
    const gap = target - current;
    return gap > 0 ? sum + roundHalfUnits(gap) : sum;
  }, 0);

  for (const member of finalization.memberDetails || []) {
    const target = Number(member.totalMeals) || 0;
    const current = currentByUser.get(member.userId) || 0;
    const gap = target - current;

    if (Math.abs(gap) < 0.000001) continue;
    if (gap < 0) {
      unresolved.push({ userId: member.userId, userName: member.userName, target, current, gap });
      continue;
    }

    const combination = findCombination(roundHalfUnits(gap), slots, runningDateHalfUnits, totalGapHalfUnits);
    if (!combination) {
      unresolved.push({ userId: member.userId, userName: member.userName, target, current, gap });
      continue;
    }

    for (const item of combination) {
      const dateKey = toDay(item.date);
      runningDateHalfUnits.set(
        dateKey,
        (runningDateHalfUnits.get(dateKey) || 0) + item.numberOfMeals * item.weightHalfUnits
      );
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

  const plannedByDate = docs.reduce((summary, doc) => {
    const dateKey = toDay(doc.date);
    const slot = slots.find(item => item.date.getTime() === doc.date.getTime() && item.mealType === doc.mealType);

    if (!summary[dateKey]) {
      summary[dateKey] = { registrationDocs: 0, mealQuantity: 0, weightedMeals: 0 };
    }

    summary[dateKey].registrationDocs += 1;
    summary[dateKey].mealQuantity += doc.numberOfMeals;
    summary[dateKey].weightedMeals += doc.numberOfMeals * slot.weight;
    return summary;
  }, {});

  const plannedMealCountDistribution = docs.reduce((summary, doc) => {
    const key = String(doc.numberOfMeals);
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {});

  for (const key of Object.keys(plannedMealCountDistribution)) {
    plannedMealCountDistribution[key] = {
      registrationDocs: plannedMealCountDistribution[key],
      percentage: Number(((plannedMealCountDistribution[key] / docs.length) * 100).toFixed(2)),
    };
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    month,
    backfillRange: { from, to },
    finalizedTotal: finalization.totalMealsServed,
    currentTotal: Array.from(currentByUser.values()).reduce((sum, value) => sum + value, 0),
    plannedBackfillTotal: plannedTotal,
    plannedInsertCount: docs.length,
    plannedByDate,
    plannedMealCountDistribution,
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
