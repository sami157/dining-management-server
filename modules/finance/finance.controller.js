const { ObjectId } = require('mongodb');
const { getCollections, getMongoClient } = require('../../config/connectMongodb');
const {
  allocateMealCosts,
  assertMonthIsOpen,
  calculateWeightedMeals,
  fromCents,
  getMonthFromDate,
  getUtcMonthRange,
  round2,
  toCents,
  validateMonth,
} = require('./accounting.utils');

const addDeposit = async (req, res) => {
  try {
    const { userId, amount, month, depositDate, notes } = req.body;
    const managerId = req.user?._id;

    if (!userId || !amount || !month) {
      return res.status(400).json({ error: 'userId, amount, and month are required' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    if (!validateMonth(month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
    }

    const { users, deposits, memberBalances, monthlyFinalization } = await getCollections();

    if (!await assertMonthIsOpen(monthlyFinalization, month)) {
      return res.status(400).json({ error: 'Cannot add deposit - month is already finalized' });
    }

    const user = await users.findOne({ _id: new ObjectId(userId), isActive: { $ne: false } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deposit = {
      userId,
      amount: round2(amount),
      month,
      depositDate: depositDate ? new Date(depositDate) : new Date(),
      notes: notes || '',
      addedBy: managerId,
      createdAt: new Date()
    };

    const result = await deposits.insertOne(deposit);

    const existingBalance = await memberBalances.findOne({ userId });

    if (existingBalance) {
      await memberBalances.updateOne(
        { userId },
        { $inc: { balance: round2(amount) }, $set: { lastUpdated: new Date() } }
      );
    } else {
      await memberBalances.insertOne({
        userId,
        balance: round2(amount),
        lastUpdated: new Date(),
        createdAt: new Date()
      });
    }

    return res.status(201).json({
      message: 'Deposit added successfully',
      depositId: result.insertedId,
      deposit: { ...deposit, _id: result.insertedId }
    });

  } catch (error) {
    console.error('Error adding deposit:', error);
    return res.status(500).json({ error: 'Failed to add deposit' });
  }
};

const getMonthlyDepositByUserId = async (req, res) => {
  try {
    const userId = req.user?._id.toString();
    const { month } = req.query;

    const { users, deposits } = await getCollections();

    const [aggregation] = await deposits.aggregate([
      { $match: { userId, month } },
      { $group: { _id: null, total: { $sum: "$amount" }, lastUpdated: { $max: "$depositDate" } } }
    ]).toArray();

    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      userId,
      userName: user.name,
      email: user.email,
      month,
      deposit: aggregation?.total ?? 0,
      lastUpdated: aggregation?.lastUpdated ?? null
    });

  } catch (error) {
    console.error('Error fetching user balance:', error);
    return res.status(500).json({ error: 'Failed to fetch user balance' });
  }
};

const addExpense = async (req, res) => {
  try {
    const { date, category, amount, description, person } = req.body;
    const managerId = req.user?._id;

    if (!date || !category || !amount) {
      return res.status(400).json({ error: 'date, category, and amount are required' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const { expenses, monthlyFinalization } = await getCollections();
    const expenseMonth = getMonthFromDate(date);

    if (!expenseMonth) {
      return res.status(400).json({ error: 'date must be a valid date string' });
    }

    if (!await assertMonthIsOpen(monthlyFinalization, expenseMonth)) {
      return res.status(400).json({ error: 'Cannot add expense - month is already finalized' });
    }

    const expense = {
      date: new Date(date),
      category,
      amount: round2(amount),
      description: description || '',
      person: person || '',
      addedBy: managerId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await expenses.insertOne(expense);

    return res.status(201).json({
      message: 'Expense added successfully',
      expenseId: result.insertedId,
      expense: { ...expense, _id: result.insertedId }
    });

  } catch (error) {
    console.error('Error adding expense:', error);
    return res.status(500).json({ error: 'Failed to add expense' });
  }
};

const getAllBalances = async (req, res) => {
  try {
    const { users, memberBalances } = await getCollections();

    const allBalances = await memberBalances.find({}).toArray();

    const userIds = allBalances
      .filter(b => ObjectId.isValid(b.userId))
      .map(b => new ObjectId(b.userId));

    const usersList = await users.find({ _id: { $in: userIds } }).toArray();
    const usersMap = {};
    for (const user of usersList) {
      usersMap[user._id.toString()] = user;
    }

    const enrichedBalances = allBalances.map(balance => {
      const user = usersMap[balance.userId];
      return {
        userId: balance.userId,
        userName: user?.name || 'Unknown',
        email: user?.email || '',
        balance: balance.balance,
        lastUpdated: balance.lastUpdated
      };
    });

    enrichedBalances.sort((a, b) => a.userName.localeCompare(b.userName));

    return res.status(200).json({ count: enrichedBalances.length, balances: enrichedBalances });

  } catch (error) {
    console.error('Error fetching balances:', error);
    return res.status(500).json({ error: 'Failed to fetch balances' });
  }
};

const getUserBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    const { users, memberBalances } = await getCollections();

    const balance = await memberBalances.findOne({ userId });

    if (!balance) {
      const user = await users.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        userId,
        userName: user.name,
        email: user.email,
        balance: 0,
        lastUpdated: null
      });
    }

    const user = await users.findOne({ _id: new ObjectId(balance.userId) });

    return res.status(200).json({
      userId: balance.userId,
      userName: user?.name || 'Unknown',
      email: user?.email || '',
      balance: balance.balance,
      lastUpdated: balance.lastUpdated
    });

  } catch (error) {
    console.error('Error fetching user balance:', error);
    return res.status(500).json({ error: 'Failed to fetch user balance' });
  }
};

const getMyBalance = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const { users, memberBalances } = await getCollections();

    const balance = await memberBalances.findOne({ userId });

    if (!balance) {
      const user = await users.findOne({ _id: userId });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        userId,
        userName: user.name,
        email: user.email,
        balance: 0,
        lastUpdated: null
      });
    }

    const user = await users.findOne({ _id: new ObjectId(balance.userId) });

    return res.status(200).json({
      userName: user?.name || 'Unknown',
      email: user?.email || 'N/A',
      balance: balance.balance.toFixed(2),
      lastUpdated: balance.lastUpdated
    });

  } catch (error) {
    console.error('Error fetching user balance:', error);
    return res.status(500).json({ error: 'Failed to fetch user balance' });
  }
};

const finalizeMonth = async (req, res) => {
  try {
    const { month } = req.body;
    const managerId = req.user?._id;

    if (!month || !validateMonth(month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
    }

    const client = await getMongoClient();
    const session = client.startSession();
    let responsePayload;

    try {
      await session.withTransaction(async () => {
        const collections = await getCollections();
        const { deposits, memberBalances, expenses, monthlyFinalization } = collections;
        const { startDate, endDate } = getUtcMonthRange(month);

        const existingFinalization = await monthlyFinalization.findOne({ month }, { session });
        if (existingFinalization) {
          const error = new Error('This month has already been finalized');
          error.statusCode = 400;
          throw error;
        }

        const mealTotals = await calculateWeightedMeals({ collections, month, session });
        const dataQuality = mealTotals.dataQuality;

        if (
          dataQuality.missingScheduleDocs > 0 ||
          dataQuality.missingMealConfigDocs > 0 ||
          dataQuality.duplicateRegistrationKeyCount > 0
        ) {
          const error = new Error('Cannot finalize month because meal registration data is inconsistent');
          error.statusCode = 400;
          error.details = dataQuality;
          throw error;
        }

        const [allDeposits, allBalances, monthExpenses] = await Promise.all([
          deposits.find({ month }, { session }).toArray(),
          memberBalances.find({}, { session }).toArray(),
          expenses.find({ date: { $gte: startDate, $lte: endDate } }, { session }).toArray(),
        ]);

        const depositsByUserCents = {};
        for (const dep of allDeposits) {
          if (!dep.userId) continue;
          const uid = dep.userId.toString();
          depositsByUserCents[uid] = (depositsByUserCents[uid] || 0) + toCents(dep.amount);
        }

        const balanceByUser = {};
        for (const balance of allBalances) {
          if (!balance.userId) continue;
          balanceByUser[balance.userId.toString()] = round2(balance.balance);
        }

        const totalExpenseCents = monthExpenses.reduce((sum, exp) => sum + toCents(exp.amount), 0);
        const totalExpenses = fromCents(totalExpenseCents);

        const expenseBreakdownCents = {};
        for (const exp of monthExpenses) {
          const category = exp.category || 'Uncategorized';
          expenseBreakdownCents[category] = (expenseBreakdownCents[category] || 0) + toCents(exp.amount);
        }
        const expenseBreakdownArray = Object.entries(expenseBreakdownCents)
          .map(([category, amountCents]) => ({ category, amount: fromCents(amountCents) }));

        const totalMealsServed = mealTotals.totalMealsServed;
        const mealRateExact = totalMealsServed > 0 ? totalExpenses / totalMealsServed : 0;
        const mealRate = round2(mealRateExact);
        const totalDeposits = fromCents(Object.values(depositsByUserCents).reduce((sum, amount) => sum + amount, 0));
        const totalFixedDeposit = round2(mealTotals.activeUsers.reduce((sum, user) => sum + (Number(user.fixedDeposit) || 0), 0));

        const membersForAllocation = mealTotals.activeUsers.map(user => {
          const userId = user._id.toString();
          return {
            user,
            userId,
            userName: user.name,
            totalMeals: mealTotals.userMealsMap.get(userId) || 0,
            totalDeposits: fromCents(depositsByUserCents[userId] || 0),
            previousBalance: balanceByUser[userId] || 0,
            mosqueFee: round2(user.mosqueFee),
          };
        });

        const allocationResult = allocateMealCosts(membersForAllocation, totalExpenses, totalMealsServed);
        const mealCostByUser = new Map(allocationResult.allocations.map(item => [item.userId, item.mealCost]));

        const memberDetails = [];
        const balanceUpdates = [];
        const now = new Date();
        let totalMosqueFeeCents = 0;
        let totalMemberBalancesAfterFinalizationCents = 0;

        for (const member of membersForAllocation) {
          const mealCost = mealCostByUser.get(member.userId) || 0;
          const newBalance = round2(member.previousBalance - mealCost - member.mosqueFee);
          totalMosqueFeeCents += toCents(member.mosqueFee);
          totalMemberBalancesAfterFinalizationCents += toCents(newBalance);

          let status = 'paid';
          if (newBalance < 0) status = 'due';
          if (newBalance > 0) status = 'advance';

          memberDetails.push({
            userId: member.userId,
            userName: member.userName,
            totalMeals: member.totalMeals,
            totalDeposits: member.totalDeposits,
            mealCost,
            mosqueFee: member.mosqueFee,
            previousBalance: member.previousBalance,
            newBalance,
            status,
          });

          balanceUpdates.push({
            updateOne: {
              filter: { userId: member.userId },
              update: { $set: { balance: newBalance, lastUpdated: now } },
              upsert: true
            }
          });
        }

        if (balanceUpdates.length > 0) {
          await memberBalances.bulkWrite(balanceUpdates, { session });
        }

        const totalMosqueFee = fromCents(totalMosqueFeeCents);
        const totalMemberBalancesAfterFinalization = fromCents(totalMemberBalancesAfterFinalizationCents);

        const finalizationRecord = {
          month, finalizedAt: now, finalizedBy: managerId,
          totalMembers: mealTotals.activeUsers.length, totalMealsServed, totalDeposits,
          totalFixedDeposit, totalMosqueFee, totalMemberBalancesAfterFinalization,
          totalExpenses, mealRate, mealRateExact,
          totalMealCost: allocationResult.totalMealCost,
          mealCostRoundingAdjustment: allocationResult.roundingAdjustment,
          memberDetails,
          expenseBreakdown: expenseBreakdownArray,
          accountingAudit: {
            allocationMethod: 'largest-remainder-cents',
            dateRange: { startDate, endDate },
            timezone: 'UTC',
            mealRateRounded: mealRate,
            mealRateExact,
            totalExpenseCents,
            totalMealCostCents: toCents(allocationResult.totalMealCost),
            sourceCounts: {
              ...dataQuality,
              expenseDocs: monthExpenses.length,
              depositDocs: allDeposits.length,
              balanceDocs: allBalances.length,
            },
          },
          isFinalized: true,
          notes: ''
        };

        const result = await monthlyFinalization.insertOne(finalizationRecord, { session });

        responsePayload = {
          message: 'Month finalized successfully',
          finalizationId: result.insertedId,
          summary: {
            month, totalMembers: mealTotals.activeUsers.length, totalMealsServed,
            totalDeposits, totalFixedDeposit, totalMosqueFee,
            totalMemberBalancesAfterFinalization, totalExpenses, mealRate,
            totalMealCost: allocationResult.totalMealCost,
            mealCostRoundingAdjustment: allocationResult.roundingAdjustment,
          }
        };
      });
    } finally {
      await session.endSession();
    }

    return res.status(201).json(responsePayload);

  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        details: error.details,
      });
    }
    console.error('Error finalizing month:', error);
    return res.status(500).json({ error: 'Failed to finalize month' });
  }
};

const getMonthFinalization = async (req, res) => {
  try {
    const { month } = req.params;

    const { monthlyFinalization } = await getCollections();
    const finalization = await monthlyFinalization.findOne({ month });

    if (!finalization) {
      return res.status(404).json({ error: 'Finalization not found for this month' });
    }

    return res.status(200).json({ finalization });

  } catch (error) {
    console.error('Error fetching finalization:', error);
    return res.status(500).json({ error: 'Failed to fetch finalization' });
  }
};

const getMyFinalizationData = async (req, res) => {
  try {
    const userId = req.user?._id.toString();
    const { month } = req.query;

    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!month || !monthRegex.test(month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
    }

    const { monthlyFinalization } = await getCollections();

    const record = await monthlyFinalization.findOne(
      { month },
      { projection: { month: 1, finalizedAt: 1, mealRate: 1, totalMealsServed: 1, totalExpenses: 1, memberDetails: 1 } }
    );

    if (!record) {
      return res.status(404).json({ error: 'No finalization record found for this month' });
    }

    const myDetails = record.memberDetails?.find(m => m.userId === userId);

    if (!myDetails) {
      return res.status(404).json({ error: 'No data found for this user in the specified month' });
    }

    return res.status(200).json({
      finalization: {
        month: record.month, finalizedAt: record.finalizedAt,
        mealRate: record.mealRate, totalMealsServed: record.totalMealsServed,
        totalExpenses: record.totalExpenses, ...myDetails
      }
    });

  } catch (error) {
    console.error('Error fetching user finalization data:', error);
    return res.status(500).json({ error: 'Failed to fetch finalization data' });
  }
};

const getAllFinalizations = async (req, res) => {
  try {
    const { monthlyFinalization } = await getCollections();
    const finalizations = await monthlyFinalization.find({}).sort({ month: -1 }).toArray();

    return res.status(200).json({ count: finalizations.length, finalizations });

  } catch (error) {
    console.error('Error fetching finalizations:', error);
    return res.status(500).json({ error: 'Failed to fetch finalizations' });
  }
};

const undoMonthFinalization = async (req, res) => {
  try {
    const { month } = req.params;

    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!month || !monthRegex.test(month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
    }

    const { memberBalances, monthlyFinalization } = await getCollections();

    const finalizationRecord = await monthlyFinalization.findOne({ month });
    if (!finalizationRecord) {
      return res.status(404).json({ error: 'No finalization record found for this month' });
    }

    const [year, monthNum] = month.split('-').map(Number);
    const nextMonthDate = new Date(year, monthNum, 1);
    const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const laterFinalization = await monthlyFinalization.findOne({ month: { $gte: nextMonthStr } });
    if (laterFinalization) {
      return res.status(400).json({
        error: `Cannot undo finalization for ${month} because ${laterFinalization.month} has already been finalized. You must undo that month first.`
      });
    }

    const { memberDetails } = finalizationRecord;

    const balanceRestores = memberDetails.map(member => ({
      updateOne: {
        filter: { userId: member.userId },
        update: { $set: { balance: member.previousBalance, lastUpdated: new Date() } },
        upsert: true
      }
    }));

    if (balanceRestores.length > 0) {
      await memberBalances.bulkWrite(balanceRestores);
    }

    await monthlyFinalization.deleteOne({ month });

    return res.status(200).json({
      message: `Finalization for ${month} has been undone successfully`,
      restoredMembers: memberDetails.length
    });

  } catch (error) {
    console.error('Error undoing month finalization:', error);
    return res.status(500).json({ error: 'Failed to undo month finalization' });
  }
};

const getAllDeposits = async (req, res) => {
  try {
    const { month, userId } = req.query;

    const query = {};
    if (month) query.month = month;
    if (userId) query.userId = userId;

    const { users, deposits } = await getCollections();

    const allDeposits = await deposits.find(query).sort({ depositDate: -1 }).toArray();

    const userIds = [...new Set(allDeposits.map(d => d.userId))]
      .filter(id => ObjectId.isValid(id))
      .map(id => new ObjectId(id));

    const usersList = await users.find({ _id: { $in: userIds } }).toArray();
    const usersMap = {};
    for (const user of usersList) {
      usersMap[user._id.toString()] = user;
    }

    let totalDeposit = 0;
    const enrichedDeposits = allDeposits.map(deposit => {
      totalDeposit += deposit.amount;
      const user = usersMap[deposit.userId];
      return { ...deposit, userName: user?.name, userEmail: user?.email };
    });

    return res.status(200).json({ count: enrichedDeposits.length, totalDeposit, deposits: enrichedDeposits });

  } catch (error) {
    console.error('Error fetching deposits:', error);
    return res.status(500).json({ error: 'Failed to fetch deposits' });
  }
};

const updateDeposit = async (req, res) => {
  try {
    const { depositId } = req.params;
    const { amount, month, depositDate, notes } = req.body;

    if (!ObjectId.isValid(depositId)) {
      return res.status(400).json({ error: 'Invalid deposit ID' });
    }

    const { deposits, memberBalances, monthlyFinalization } = await getCollections();

    const existingDeposit = await deposits.findOne({ _id: new ObjectId(depositId) });
    if (!existingDeposit) {
      return res.status(404).json({ error: 'Deposit not found' });
    }

    if (month !== undefined && !validateMonth(month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
    }

    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const targetMonth = month || existingDeposit.month;
    const finalizedMonth = await monthlyFinalization.findOne({
      month: { $in: [...new Set([existingDeposit.month, targetMonth])] }
    });
    if (finalizedMonth) {
      return res.status(400).json({ error: 'Cannot update deposit - month is already finalized' });
    }

    const oldAmount = round2(existingDeposit.amount);
    const newAmount = amount !== undefined ? round2(amount) : oldAmount;
    const amountDifference = round2(newAmount - oldAmount);

    const updateData = { updatedAt: new Date() };
    if (amount !== undefined) updateData.amount = newAmount;
    if (month !== undefined) updateData.month = month;
    if (depositDate !== undefined) updateData.depositDate = new Date(depositDate);
    if (notes !== undefined) updateData.notes = notes;

    await deposits.updateOne({ _id: new ObjectId(depositId) }, { $set: updateData });

    if (amountDifference !== 0) {
      await memberBalances.updateOne(
        { userId: existingDeposit.userId },
        { $inc: { balance: amountDifference }, $set: { lastUpdated: new Date() } }
      );
    }

    return res.status(200).json({ message: 'Deposit updated successfully' });

  } catch (error) {
    console.error('Error updating deposit:', error);
    return res.status(500).json({ error: 'Failed to update deposit' });
  }
};

const deleteDeposit = async (req, res) => {
  try {
    const { depositId } = req.params;

    if (!ObjectId.isValid(depositId)) {
      return res.status(400).json({ error: 'Invalid deposit ID' });
    }

    const { deposits, memberBalances, monthlyFinalization } = await getCollections();

    const existingDeposit = await deposits.findOne({ _id: new ObjectId(depositId) });
    if (!existingDeposit) {
      return res.status(404).json({ error: 'Deposit not found' });
    }

    const finalized = await monthlyFinalization.findOne({ month: existingDeposit.month });
    if (finalized) {
      return res.status(400).json({ error: 'Cannot delete deposit - month is already finalized' });
    }

    await deposits.deleteOne({ _id: new ObjectId(depositId) });

    await memberBalances.updateOne(
      { userId: existingDeposit.userId },
      { $inc: { balance: -round2(existingDeposit.amount) }, $set: { lastUpdated: new Date() } }
    );

    return res.status(200).json({ message: 'Deposit deleted successfully' });

  } catch (error) {
    console.error('Error deleting deposit:', error);
    return res.status(500).json({ error: 'Failed to delete deposit' });
  }
};

const getAllExpenses = async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;

    const query = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }
    if (category) query.category = category;

    const { users, expenses } = await getCollections();

    const allExpenses = await expenses.find(query).sort({ date: -1 }).toArray();

    const managerIds = [...new Set(allExpenses.map(e => e.addedBy?.toString()).filter(id => id && ObjectId.isValid(id)))]
      .map(id => new ObjectId(id));

    const managersList = await users.find({ _id: { $in: managerIds } }).toArray();
    const managersMap = {};
    for (const manager of managersList) {
      managersMap[manager._id.toString()] = manager;
    }

    const enrichedExpenses = allExpenses.map(expense => ({
      ...expense,
      addedByName: managersMap[expense.addedBy?.toString()]?.name || 'Unknown'
    }));

    return res.status(200).json({ count: enrichedExpenses.length, expenses: enrichedExpenses });

  } catch (error) {
    console.error('Error fetching expenses:', error);
    return res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { date, category, amount, description, person } = req.body;

    if (!ObjectId.isValid(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const { expenses, monthlyFinalization } = await getCollections();

    const existingExpense = await expenses.findOne({ _id: new ObjectId(expenseId) });
    if (!existingExpense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const expenseMonth = getMonthFromDate(existingExpense.date);
    const targetMonth = date !== undefined ? getMonthFromDate(date) : expenseMonth;

    if (!targetMonth) {
      return res.status(400).json({ error: 'date must be a valid date string' });
    }

    const finalized = await monthlyFinalization.findOne({
      month: { $in: [...new Set([expenseMonth, targetMonth])] }
    });
    if (finalized) {
      return res.status(400).json({ error: 'Cannot update expense - month is already finalized' });
    }

    const updateData = { updatedAt: new Date() };
    if (date !== undefined) {
      const newDate = new Date(date);
      newDate.setHours(0, 0, 0, 0);
      updateData.date = newDate;
    }
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) updateData.amount = round2(amount);
    if (description !== undefined) updateData.description = description;
    if (person !== undefined) updateData.person = person;

    await expenses.updateOne({ _id: new ObjectId(expenseId) }, { $set: updateData });

    return res.status(200).json({ message: 'Expense updated successfully' });

  } catch (error) {
    console.error('Error updating expense:', error);
    return res.status(500).json({ error: 'Failed to update expense' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    if (!ObjectId.isValid(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const { expenses, monthlyFinalization } = await getCollections();

    const existingExpense = await expenses.findOne({ _id: new ObjectId(expenseId) });
    if (!existingExpense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expenseMonth = getMonthFromDate(existingExpense.date);
    const finalized = await monthlyFinalization.findOne({ month: expenseMonth });
    if (finalized) {
      return res.status(400).json({ error: 'Cannot delete expense - month is already finalized' });
    }

    await expenses.deleteOne({ _id: new ObjectId(expenseId) });

    return res.status(200).json({ message: 'Expense deleted successfully' });

  } catch (error) {
    console.error('Error deleting expense:', error);
    return res.status(500).json({ error: 'Failed to delete expense' });
  }
};

module.exports = {
  addDeposit,
  getMonthlyDepositByUserId,
  addExpense,
  getAllBalances,
  getUserBalance,
  getMyBalance,
  finalizeMonth,
  getMonthFinalization,
  getMyFinalizationData,
  getAllFinalizations,
  undoMonthFinalization,
  getAllDeposits,
  updateDeposit,
  deleteDeposit,
  getAllExpenses,
  updateExpense,
  deleteExpense
};
