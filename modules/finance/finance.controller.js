const { ObjectId } = require('mongodb');
const { format } = require('date-fns');
const { deposits, memberBalances, users, expenses } = require('../../config/connectMongodb');

addDeposit = async (req, res) => {
  try {
    const { userId, amount, month, depositDate, notes } = req.body;
    const managerId = req.user?._id || 'temp';

    // Validate required fields
    if (!userId || !amount || !month) {
      return res.status(400).json({
        error: 'userId, amount, and month are required'
      });
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'amount must be a positive number'
      });
    }

    // Validate month format (YYYY-MM)
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthRegex.test(month)) {
      return res.status(400).json({
        error: 'month must be in YYYY-MM format (e.g., 2025-01)'
      });
    }

    // Check if user exists
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Create deposit record
    const deposit = {
      userId: userId,  // Member whose account gets credited
      amount: amount,
      month: month,
      depositDate: depositDate ? new Date(depositDate) : new Date(),
      notes: notes || '',
      addedBy: managerId,  // Manager who recorded it
      createdAt: new Date()
    };

    const result = await deposits.insertOne(deposit);

    // Update member balance
    const existingBalance = await memberBalances.findOne({ userId: userId });

    if (existingBalance) {
      // Update existing balance
      await memberBalances.updateOne(
        { userId: userId },
        {
          $inc: { balance: amount },
          $set: { lastUpdated: new Date() }
        }
      );
    } else {
      // Create new balance record
      await memberBalances.insertOne({
        userId: userId,
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
    return res.status(500).json({
      error: 'Failed to add deposit'
    });
  }
};

addExpense = async (req, res) => {
  try {
    const { date, category, amount, description, receiptUrl, userId } = req.body;
    const managerId = req.user?._id || 'temp';

    // Validate required fields
    if (!date || !category || !amount || !userId) {
      return res.status(400).json({
        error: 'date, category, amount, and userId are required'
      });
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'amount must be a positive number'
      });
    }

    // Check if user exists
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const expenseDate = new Date(date);
    expenseDate.setHours(12, 0, 0, 0); // Normalize to noon

    // Create expense record
    const expense = {
      userId: userId,  // Added userId
      date: expenseDate,
      category: category,
      amount: amount,
      description: description || '',
      receiptUrl: receiptUrl || '',
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
    return res.status(500).json({
      error: 'Failed to add expense'
    });
  }
};

getAllBalances = async (req, res) => {
  try {
    // Fetch all member balances
    const balances = await memberBalances.find({}).toArray();

    // Fetch user details for each balance
    const enrichedBalances = await Promise.all(
      balances.map(async (balance) => {
        const user = await users.findOne({ _id: new ObjectId(balance.userId) });
        return {
          userId: balance.userId,
          userName: user?.name || 'Unknown',
          email: user?.email || '',
          balance: balance.balance,
          lastUpdated: balance.lastUpdated
        };
      })
    );

    // Sort by user name
    enrichedBalances.sort((a, b) => a.userName.localeCompare(b.userName));

    return res.status(200).json({
      count: enrichedBalances.length,
      balances: enrichedBalances
    });

  } catch (error) {
    console.error('Error fetching balances:', error);
    return res.status(500).json({
      error: 'Failed to fetch balances'
    });
  }
};

// Get balance for a specific user
getUserBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user balance
    const balance = await memberBalances.findOne({ userId: userId });

    if (!balance) {
      // User exists but no balance record yet (no deposits)
      const user = await users.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      return res.status(200).json({
        userId: userId,
        userName: user.name,
        email: user.email,
        balance: 0,
        lastUpdated: null
      });
    }

    // Fetch user details
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
    return res.status(500).json({
      error: 'Failed to fetch user balance'
    });
  }
};

finalizeMonth = async (req, res) => {
  try {
    const { month } = req.body;
    const managerId = req.user?._id || 'temp';

    // Validate month format (YYYY-MM)
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!month || !monthRegex.test(month)) {
      return res.status(400).json({
        error: 'month must be in YYYY-MM format (e.g., 2025-01)'
      });
    }

    // Check if month is already finalized
    const existingFinalization = await monthlyFinalization.findOne({ month });
    if (existingFinalization) {
      return res.status(400).json({
        error: 'This month has already been finalized'
      });
    }

    // Calculate date range for the month
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // 1. Get all active users
    const allUsers = await users.find({ isActive: { $ne: false } }).toArray();
    const totalMembers = allUsers.length;

    // 2. Calculate total meals for each user (with weights)
    const userMealsMap = {};
    let totalMealsServed = 0;

    for (const user of allUsers) {
      const registrations = await mealRegistrations.find({
        userId: user._id.toString(),
        date: { $gte: startDate, $lte: endDate }
      }).toArray();

      let userTotalMeals = 0;

      for (const registration of registrations) {
        const schedule = await mealSchedules.findOne({ date: registration.date });
        if (schedule) {
          const meal = schedule.availableMeals.find(m => m.mealType === registration.mealType);
          const weight = meal?.weight || 1;
          userTotalMeals += weight;
        }
      }

      userMealsMap[user._id.toString()] = userTotalMeals;
      totalMealsServed += userTotalMeals;
    }

    // 3. Calculate total deposits per user
    const userDepositsMap = {};
    let totalDeposits = 0;

    for (const user of allUsers) {
      const userDeposits = await deposits.find({
        userId: user._id.toString(),
        month: month
      }).toArray();

      const userDepositTotal = userDeposits.reduce((sum, dep) => sum + dep.amount, 0);
      userDepositsMap[user._id.toString()] = userDepositTotal;
      totalDeposits += userDepositTotal;
    }

    // 4. Calculate total expenses
    const monthExpenses = await expenses.find({
      date: { $gte: startDate, $lte: endDate }
    }).toArray();

    const totalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 5. Calculate expense breakdown by category
    const expenseBreakdown = {};
    monthExpenses.forEach(exp => {
      expenseBreakdown[exp.category] = (expenseBreakdown[exp.category] || 0) + exp.amount;
    });

    const expenseBreakdownArray = Object.keys(expenseBreakdown).map(cat => ({
      category: cat,
      amount: expenseBreakdown[cat]
    }));

    // 6. Calculate meal rate
    const mealRate = totalMealsServed > 0 ? totalExpenses / totalMealsServed : 0;

    // 7. Calculate member-wise details
    const memberDetails = [];

    for (const user of allUsers) {
      const userId = user._id.toString();
      const totalMeals = userMealsMap[userId] || 0;
      const totalUserDeposits = userDepositsMap[userId] || 0;
      const mealCost = totalMeals * mealRate;

      // Get previous balance
      const balanceRecord = await memberBalances.findOne({ userId });
      const previousBalance = balanceRecord?.balance || 0;

      // Calculate new balance
      const newBalance = previousBalance + totalUserDeposits - mealCost;

      // Determine status
      let status = 'paid';
      if (newBalance < 0) status = 'due';
      if (newBalance > 0) status = 'advance';

      memberDetails.push({
        userId: userId,
        userName: user.name,
        totalMeals: totalMeals,
        totalDeposits: totalUserDeposits,
        mealCost: mealCost,
        previousBalance: previousBalance,
        newBalance: newBalance,
        status: status
      });

      // Update member balance
      await memberBalances.updateOne(
        { userId },
        {
          $set: {
            balance: newBalance,
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
    }

    // 8. Create finalization record
    const finalizationRecord = {
      month: month,
      finalizedAt: new Date(),
      finalizedBy: managerId,
      totalMembers: totalMembers,
      totalMealsServed: totalMealsServed,
      totalDeposits: totalDeposits,
      totalExpenses: totalExpenses,
      mealRate: mealRate,
      memberDetails: memberDetails,
      expenseBreakdown: expenseBreakdownArray,
      isFinalized: true,
      notes: ''
    };

    const result = await monthlyFinalization.insertOne(finalizationRecord);

    return res.status(201).json({
      message: 'Month finalized successfully',
      finalizationId: result.insertedId,
      summary: {
        month,
        totalMembers,
        totalMealsServed,
        totalDeposits,
        totalExpenses,
        mealRate: parseFloat(mealRate.toFixed(2))
      }
    });

  } catch (error) {
    console.error('Error finalizing month:', error);
    return res.status(500).json({
      error: 'Failed to finalize month'
    });
  }
};

// Get finalization details for a specific month
getMonthFinalization = async (req, res) => {
  try {
    const { month } = req.params;

    const finalization = await monthlyFinalization.findOne({ month });

    if (!finalization) {
      return res.status(404).json({
        error: 'Finalization not found for this month'
      });
    }

    return res.status(200).json({
      finalization
    });

  } catch (error) {
    console.error('Error fetching finalization:', error);
    return res.status(500).json({
      error: 'Failed to fetch finalization'
    });
  }
};

// Get all finalization history
getAllFinalizations = async (req, res) => {
  try {
    const finalizations = await monthlyFinalization.find({})
      .sort({ month: -1 })
      .toArray();

    return res.status(200).json({
      count: finalizations.length,
      finalizations: finalizations
    });

  } catch (error) {
    console.error('Error fetching finalizations:', error);
    return res.status(500).json({
      error: 'Failed to fetch finalizations'
    });
  }
};

module.exports = {
  addDeposit,
  addExpense,
  getAllBalances,
  getUserBalance,
  finalizeMonth,
  getMonthFinalization,
  getAllFinalizations
}