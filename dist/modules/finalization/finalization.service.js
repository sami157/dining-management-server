"use strict";
const { getCollections, withMongoTransaction } = require('../../config/connectMongodb');
const { createHttpError } = require('../finance/finance.utils');
const { formatServiceDate, getCurrentServiceDate, getMonthServiceDateRange } = require('../shared/date.utils');
const buildCanonicalServiceDateRangeQuery = (startDate, endDate) => ({
    serviceDate: { $gte: startDate, $lte: endDate }
});
const finalizeMonthSummary = async (month, managerId) => {
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!month || !monthRegex.test(month)) {
        throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
    }
    return withMongoTransaction(async (session) => {
        const { users, mealRegistrations, mealSchedules, deposits, memberBalances, expenses, monthlyFinalization } = await getCollections();
        const existingFinalization = await monthlyFinalization.findOne({ month }, { session });
        if (existingFinalization) {
            throw createHttpError(400, 'This month has already been finalized');
        }
        const { startServiceDate, endServiceDate } = getMonthServiceDateRange(month);
        const [allUsers, allRegistrations, allSchedules, allDeposits, allBalances, monthExpenses] = await Promise.all([
            users.find({ isActive: { $ne: false } }, { session }).toArray(),
            mealRegistrations.find(buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate), { session }).toArray(),
            mealSchedules.find(buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate), { session }).toArray(),
            deposits.find({ month }, { session }).toArray(),
            memberBalances.find({}, { session }).toArray(),
            expenses.find(buildCanonicalServiceDateRangeQuery(startServiceDate, endServiceDate), { session }).toArray()
        ]);
        const scheduleMap = {};
        for (const schedule of allSchedules) {
            scheduleMap[schedule.serviceDate] = schedule;
        }
        const registrationsByUser = {};
        for (const registration of allRegistrations) {
            if (!registration.userId)
                continue;
            const uid = registration.userId.toString();
            if (!registrationsByUser[uid])
                registrationsByUser[uid] = [];
            registrationsByUser[uid].push(registration);
        }
        const depositsByUser = {};
        for (const deposit of allDeposits) {
            if (!deposit.userId)
                continue;
            const uid = deposit.userId.toString();
            depositsByUser[uid] = (depositsByUser[uid] || 0) + deposit.amount;
        }
        const balanceByUser = {};
        for (const balance of allBalances) {
            if (!balance.userId)
                continue;
            balanceByUser[balance.userId.toString()] = balance.balance || 0;
        }
        const totalExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const expenseBreakdown = {};
        for (const expense of monthExpenses) {
            expenseBreakdown[expense.category] = (expenseBreakdown[expense.category] || 0) + expense.amount;
        }
        const expenseBreakdownArray = Object.entries(expenseBreakdown).map(([category, amount]) => ({ category, amount }));
        const userMealsMap = {};
        let totalMealsServed = 0;
        for (const user of allUsers) {
            const userId = user._id.toString();
            const userRegistrations = registrationsByUser[userId] || [];
            let userTotalMeals = 0;
            for (const registration of userRegistrations) {
                const schedule = scheduleMap[registration.serviceDate];
                if (!schedule)
                    continue;
                const meal = schedule.availableMeals.find(item => item.mealType === registration.mealType);
                const weight = meal?.weight || 1;
                const numberOfMeals = registration.numberOfMeals || 1;
                userTotalMeals += numberOfMeals * weight;
            }
            userMealsMap[userId] = userTotalMeals;
            totalMealsServed += userTotalMeals;
        }
        const mealRate = totalMealsServed > 0
            ? parseFloat((totalExpenses / totalMealsServed).toFixed(2))
            : 0;
        const totalDeposits = Object.values(depositsByUser).reduce((sum, amount) => sum + amount, 0);
        const memberDetails = [];
        const balanceUpdates = [];
        const now = new Date();
        for (const user of allUsers) {
            const userId = user._id.toString();
            const totalMeals = userMealsMap[userId] || 0;
            // Reporting-only: deposits are already reflected in previousBalance via memberBalances.
            const totalUserDepositsForReporting = depositsByUser[userId] || 0;
            const mealCost = totalMeals * mealRate;
            const previousBalance = balanceByUser[userId] || 0;
            const mosqueFee = user.mosqueFee || 0;
            const newBalance = previousBalance - mealCost - mosqueFee;
            let status = 'paid';
            if (newBalance < 0)
                status = 'due';
            if (newBalance > 0)
                status = 'advance';
            memberDetails.push({
                userId,
                userName: user.name,
                totalMeals,
                totalDeposits: totalUserDepositsForReporting,
                mealCost,
                mosqueFee,
                previousBalance,
                newBalance,
                status
            });
            balanceUpdates.push({
                updateOne: {
                    filter: { userId },
                    update: {
                        $set: { balance: newBalance, lastUpdated: now },
                        $setOnInsert: { createdAt: now }
                    },
                    upsert: true
                }
            });
        }
        if (balanceUpdates.length > 0) {
            await memberBalances.bulkWrite(balanceUpdates, { session });
        }
        const finalizationRecord = {
            month,
            finalizedAt: now,
            finalizedDate: getCurrentServiceDate(),
            finalizedBy: managerId,
            totalMembers: allUsers.length,
            totalMealsServed,
            totalDeposits,
            totalExpenses,
            mealRate,
            memberDetails,
            expenseBreakdown: expenseBreakdownArray,
            isFinalized: true,
            notes: ''
        };
        const result = await monthlyFinalization.insertOne(finalizationRecord, { session });
        return {
            finalizationId: result.insertedId,
            summary: {
                month,
                totalMembers: allUsers.length,
                totalMealsServed,
                totalDeposits,
                totalExpenses,
                mealRate: parseFloat(mealRate.toFixed(2))
            }
        };
    });
};
const getFinalizationByMonth = async (month) => {
    const { monthlyFinalization } = await getCollections();
    const finalization = await monthlyFinalization.findOne({ month });
    if (!finalization) {
        throw createHttpError(404, 'Finalization not found for this month');
    }
    return {
        finalization: {
            ...finalization,
            finalizedDate: finalization.finalizedDate || formatServiceDate(finalization.finalizedAt)
        }
    };
};
const getCurrentUserFinalization = async (userId, month) => {
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!month || !monthRegex.test(month)) {
        throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
    }
    const { monthlyFinalization } = await getCollections();
    const record = await monthlyFinalization.findOne({ month }, { projection: { month: 1, finalizedAt: 1, mealRate: 1, totalMealsServed: 1, totalExpenses: 1, memberDetails: 1 } });
    if (!record) {
        throw createHttpError(404, 'No finalization record found for this month');
    }
    const myDetails = record.memberDetails?.find(member => member.userId === userId);
    if (!myDetails) {
        throw createHttpError(404, 'No data found for this user in the specified month');
    }
    return {
        finalization: {
            month: record.month,
            finalizedAt: record.finalizedAt,
            finalizedDate: record.finalizedDate || formatServiceDate(record.finalizedAt),
            mealRate: record.mealRate,
            totalMealsServed: record.totalMealsServed,
            totalExpenses: record.totalExpenses,
            ...myDetails
        }
    };
};
const listFinalizations = async () => {
    const { monthlyFinalization } = await getCollections();
    const finalizations = await monthlyFinalization.find({}).sort({ month: -1 }).toArray();
    return {
        count: finalizations.length,
        finalizations: finalizations.map((item) => ({
            ...item,
            finalizedDate: item.finalizedDate || formatServiceDate(item.finalizedAt)
        }))
    };
};
const undoFinalizationByMonth = async (month) => {
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!month || !monthRegex.test(month)) {
        throw createHttpError(400, 'month must be in YYYY-MM format (e.g., 2025-01)');
    }
    return withMongoTransaction(async (session) => {
        const { memberBalances, monthlyFinalization } = await getCollections();
        const finalizationRecord = await monthlyFinalization.findOne({ month }, { session });
        if (!finalizationRecord) {
            throw createHttpError(404, 'No finalization record found for this month');
        }
        const [year, monthNum] = month.split('-').map(Number);
        const nextMonthDate = new Date(year, monthNum, 1);
        const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
        const laterFinalization = await monthlyFinalization.findOne({ month: { $gte: nextMonthStr } }, { session });
        if (laterFinalization) {
            throw createHttpError(400, `Cannot undo finalization for ${month} because ${laterFinalization.month} has already been finalized. You must undo that month first.`);
        }
        const now = new Date();
        const balanceRestores = finalizationRecord.memberDetails.map(member => ({
            updateOne: {
                filter: { userId: member.userId },
                update: {
                    $set: { balance: member.previousBalance, lastUpdated: now },
                    $setOnInsert: { createdAt: now }
                },
                upsert: true
            }
        }));
        if (balanceRestores.length > 0) {
            await memberBalances.bulkWrite(balanceRestores, { session });
        }
        await monthlyFinalization.deleteOne({ month }, { session });
        return { restoredMembers: finalizationRecord.memberDetails.length };
    });
};
module.exports = {
    finalizeMonthSummary,
    getFinalizationByMonth,
    getCurrentUserFinalization,
    listFinalizations,
    undoFinalizationByMonth
};
