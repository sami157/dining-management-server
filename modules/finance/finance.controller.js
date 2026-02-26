const { ObjectId } = require('mongodb');
const { format } = require('date-fns');
const { getCollections } = require('../../config/connectMongodb');

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

    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
    }

    const { users, deposits, memberBalances } = await getCollections();

    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deposit = {
      userId,
      amount,
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
        { $inc: { balance: amount }, $set: { lastUpdated: new Date() } }
      );
    } else {
      await memberBalances.insertOne({
        userId,
        balance: amount,
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

    const deposit = await deposits.findOne({ userId, month });

    if (!deposit) {
      const user = await users.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        userId,
        userName: user.name,
        email: user.email,
        month,
        deposit: 0,
        lastUpdated: null
      });
    }

    const user = await users.findOne({ _id: new ObjectId(deposit.userId) });

    return res.status(200).json({
      userId: deposit.userId,
      userName: user?.name,
      email: user?.email,
      month: deposit.month,
      deposit: deposit.amount,
      lastUpdated: deposit.depositDate
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

    const { expenses } = await getCollections();

    const expense = {
      date: new Date(date),
      category,
      amount,
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

const getRunningMealRate = async (req, res) => {
  try {
    const { month, date } = req.query;

    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!month || !monthRegex.test(month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
    }

    const targetDate = date ? new Date(date) : new Date();
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'date must be a valid date string (e.g., 2025-01-15)' });
    }

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const { users, mealRegistrations, mealSchedules, expenses } = await getCollections();

    const [allUsers, allRegistrations, allSchedules, monthExpenses] = await Promise.all([
      users.find({ isActive: { $ne: false } }).toArray(),
      mealRegistrations.find({ date: { $gte: startDate, $lte: endDate } }).toArray(),
      mealSchedules.find({ date: { $gte: startDate, $lte: endDate } }).toArray(),
      expenses.find({ date: { $gte: startDate, $lte: endDate } }).toArray(),
    ]);

    const scheduleMap = {};
    for (const schedule of allSchedules) {
      scheduleMap[schedule.date.toISOString()] = schedule;
    }

    let totalMealsServed = 0;
    for (const reg of allRegistrations) {
      const schedule = scheduleMap[reg.date.toISOString()];
      if (schedule) {
        const meal = schedule.availableMeals.find(m => m.mealType === reg.mealType);
        const weight = meal?.weight || 1;
        const numberOfMeals = reg.numberOfMeals || 1;
        totalMealsServed += numberOfMeals * weight;
      }
    }

    const totalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const mealRate = totalMealsServed > 0 ? totalExpenses / totalMealsServed : 0;

    return res.status(200).json({
      month,
      asOf: targetDate.toISOString().split('T')[0],
      totalMealsServed,
      totalExpenses,
      mealRate: parseFloat(mealRate.toFixed(2))
    });

  } catch (error) {
    console.error('Error calculating running meal rate:', error);
    return res.status(500).json({ error: 'Failed to calculate running meal rate' });
  }
};

const finalizeMonth = async (req, res) => {
  try {
    const { month } = req.body;
    const managerId = req.user?._id;

    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!month || !monthRegex.test(month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format (e.g., 2025-01)' });
    }

    const {
      users, mealRegistrations, mealSchedules,
      deposits, memberBalances, expenses, monthlyFinalization
    } = await getCollections();

    const existingFinalization = await monthlyFinalization.findOne({ month });
    if (existingFinalization) {
      return res.status(400).json({ error: 'This month has already been finalized' });
    }

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const [allUsers, allRegistrations, allSchedules, allDeposits, allBalances, monthExpenses] =
      await Promise.all([
        users.find({ isActive: { $ne: false } }).toArray(),
        mealRegistrations.find({ date: { $gte: startDate, $lte: endDate } }).toArray(),
        mealSchedules.find({ date: { $gte: startDate, $lte: endDate } }).toArray(),
        deposits.find({ month }).toArray(),
        memberBalances.find({}).toArray(),
        expenses.find({ date: { $gte: startDate, $lte: endDate } }).toArray(),
      ]);

    const scheduleMap = {};
    for (const schedule of allSchedules) {
      scheduleMap[schedule.date.toISOString()] = schedule;
    }

    const registrationsByUser = {};
    for (const reg of allRegistrations) {
      const uid = reg.userId.toString();
      if (!registrationsByUser[uid]) registrationsByUser[uid] = [];
      registrationsByUser[uid].push(reg);
    }

    const depositsByUser = {};
    for (const dep of allDeposits) {
      const uid = dep.userId.toString();
      depositsByUser[uid] = (depositsByUser[uid] || 0) + dep.amount;
    }

    const balanceByUser = {};
    for (const b of allBalances) {
      balanceByUser[b.userId] = b.balance || 0;
    }

    const totalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const expenseBreakdown = {};
    for (const exp of monthExpenses) {
      expenseBreakdown[exp.category] = (expenseBreakdown[exp.category] || 0) + exp.amount;
    }
    const expenseBreakdownArray = Object.entries(expenseBreakdown).map(([category, amount]) => ({ category, amount }));

    const userMealsMap = {};
    let totalMealsServed = 0;

    for (const user of allUsers) {
      const userId = user._id.toString();
      const userRegs = registrationsByUser[userId] || [];
      let userTotalMeals = 0;

      for (const reg of userRegs) {
        const schedule = scheduleMap[reg.date.toISOString()];
        if (schedule) {
          const meal = schedule.availableMeals.find(m => m.mealType === reg.mealType);
          const weight = meal?.weight || 1;
          const numberOfMeals = reg.numberOfMeals || 1;
          userTotalMeals += numberOfMeals * weight;
        }
      }

      userMealsMap[userId] = userTotalMeals;
      totalMealsServed += userTotalMeals;
    }

    const mealRate = totalMealsServed > 0 ? totalExpenses / totalMealsServed : 0;
    const totalDeposits = Object.values(depositsByUser).reduce((sum, amt) => sum + amt, 0);

    const memberDetails = [];
    const balanceUpdates = [];
    const now = new Date();

    for (const user of allUsers) {
      const userId = user._id.toString();
      const totalMeals = userMealsMap[userId] || 0;
      const totalUserDeposits = depositsByUser[userId] || 0;
      const mealCost = totalMeals * mealRate;
      const previousBalance = balanceByUser[userId] || 0;
      const mosqueFee = user.mosqueFee || 0;
      const newBalance = previousBalance + totalUserDeposits - mealCost - mosqueFee;

      let status = 'paid';
      if (newBalance < 0) status = 'due';
      if (newBalance > 0) status = 'advance';

      memberDetails.push({ userId, userName: user.name, totalMeals, totalDeposits: totalUserDeposits, mealCost, mosqueFee, previousBalance, newBalance, status });

      balanceUpdates.push({
        updateOne: {
          filter: { userId },
          update: { $set: { balance: newBalance, lastUpdated: now } },
          upsert: true
        }
      });
    }

    if (balanceUpdates.length > 0) {
      await memberBalances.bulkWrite(balanceUpdates);
    }

    const finalizationRecord = {
      month, finalizedAt: now, finalizedBy: managerId,
      totalMembers: allUsers.length, totalMealsServed, totalDeposits,
      totalExpenses, mealRate, memberDetails,
      expenseBreakdown: expenseBreakdownArray, isFinalized: true, notes: ''
    };

    const result = await monthlyFinalization.insertOne(finalizationRecord);

    return res.status(201).json({
      message: 'Month finalized successfully',
      finalizationId: result.insertedId,
      summary: {
        month, totalMembers: allUsers.length, totalMealsServed,
        totalDeposits, totalExpenses, mealRate: parseFloat(mealRate.toFixed(2))
      }
    });

  } catch (error) {
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

    if (month && month !== existingDeposit.month) {
      const finalized = await monthlyFinalization.findOne({ month: existingDeposit.month });
      if (finalized) {
        return res.status(400).json({ error: 'Cannot update deposit - month is already finalized' });
      }
    }

    const oldAmount = existingDeposit.amount;
    const newAmount = amount !== undefined ? amount : oldAmount;
    const amountDifference = newAmount - oldAmount;

    const updateData = { updatedAt: new Date() };
    if (amount !== undefined) updateData.amount = amount;
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
      { $inc: { balance: -existingDeposit.amount }, $set: { lastUpdated: new Date() } }
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
    const { date, category, amount, description } = req.body;

    if (!ObjectId.isValid(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const { expenses, monthlyFinalization } = await getCollections();

    const existingExpense = await expenses.findOne({ _id: new ObjectId(expenseId) });
    if (!existingExpense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const expenseMonth = format(existingExpense.date, 'yyyy-MM');
    const finalized = await monthlyFinalization.findOne({ month: expenseMonth });
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
    if (amount !== undefined) updateData.amount = amount;
    if (description !== undefined) updateData.description = description;

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

    const expenseMonth = format(existingExpense.date, 'yyyy-MM');
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
  getRunningMealRate,
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