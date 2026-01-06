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


// Get all deposits (with optional filters)
getAllDeposits = async (req, res) => {
  try {
    const { month, userId } = req.query;
    
    const query = {};
    if (month) query.month = month;
    if (userId) query.userId = userId;

    const allDeposits = await deposits.find(query)
      .sort({ depositDate: -1 })
      .toArray();

    // Enrich with user details
    const enrichedDeposits = await Promise.all(
      allDeposits.map(async (deposit) => {
        const user = await users.findOne({ _id: new ObjectId(deposit.userId) });
        return {
          ...deposit,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || ''
        };
      })
    );

    return res.status(200).json({
      count: enrichedDeposits.length,
      deposits: enrichedDeposits
    });

  } catch (error) {
    console.error('Error fetching deposits:', error);
    return res.status(500).json({
      error: 'Failed to fetch deposits'
    });
  }
};

// Update deposit
updateDeposit = async (req, res) => {
  try {
    const { depositId } = req.params;
    const { amount, month, depositDate, notes } = req.body;

    if (!ObjectId.isValid(depositId)) {
      return res.status(400).json({
        error: 'Invalid deposit ID'
      });
    }

    // Find existing deposit
    const existingDeposit = await deposits.findOne({ _id: new ObjectId(depositId) });
    if (!existingDeposit) {
      return res.status(404).json({
        error: 'Deposit not found'
      });
    }

    // Check if month is finalized
    if (month && month !== existingDeposit.month) {
      const finalized = await monthlyFinalization.findOne({ month: existingDeposit.month });
      if (finalized) {
        return res.status(400).json({
          error: 'Cannot update deposit - month is already finalized'
        });
      }
    }

    const oldAmount = existingDeposit.amount;
    const newAmount = amount !== undefined ? amount : oldAmount;
    const amountDifference = newAmount - oldAmount;

    // Build update object
    const updateData = { updatedAt: new Date() };
    if (amount !== undefined) updateData.amount = amount;
    if (month !== undefined) updateData.month = month;
    if (depositDate !== undefined) updateData.depositDate = new Date(depositDate);
    if (notes !== undefined) updateData.notes = notes;

    // Update deposit
    await deposits.updateOne(
      { _id: new ObjectId(depositId) },
      { $set: updateData }
    );

    // Update member balance if amount changed
    if (amountDifference !== 0) {
      await memberBalances.updateOne(
        { userId: existingDeposit.userId },
        {
          $inc: { balance: amountDifference },
          $set: { lastUpdated: new Date() }
        }
      );
    }

    return res.status(200).json({
      message: 'Deposit updated successfully'
    });

  } catch (error) {
    console.error('Error updating deposit:', error);
    return res.status(500).json({
      error: 'Failed to update deposit'
    });
  }
};

// Delete deposit
deleteDeposit = async (req, res) => {
  try {
    const { depositId } = req.params;

    if (!ObjectId.isValid(depositId)) {
      return res.status(400).json({
        error: 'Invalid deposit ID'
      });
    }

    // Find existing deposit
    const existingDeposit = await deposits.findOne({ _id: new ObjectId(depositId) });
    if (!existingDeposit) {
      return res.status(404).json({
        error: 'Deposit not found'
      });
    }

    // Check if month is finalized
    const finalized = await monthlyFinalization.findOne({ month: existingDeposit.month });
    if (finalized) {
      return res.status(400).json({
        error: 'Cannot delete deposit - month is already finalized'
      });
    }

    // Delete deposit
    await deposits.deleteOne({ _id: new ObjectId(depositId) });

    // Update member balance (subtract the amount)
    await memberBalances.updateOne(
      { userId: existingDeposit.userId },
      {
        $inc: { balance: -existingDeposit.amount },
        $set: { lastUpdated: new Date() }
      }
    );

    return res.status(200).json({
      message: 'Deposit deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting deposit:', error);
    return res.status(500).json({
      error: 'Failed to delete deposit'
    });
  }
};



// Get all expenses (with optional filters)
getAllExpenses = async (req, res) => {
  try {
    const { startDate, endDate, category, userId } = req.query;
    
    const query = {};
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }
    
    if (category) query.category = category;
    if (userId) query.userId = userId;

    const allExpenses = await expenses.find(query)
      .sort({ date: -1 })
      .toArray();

    // Enrich with user details
    const enrichedExpenses = await Promise.all(
      allExpenses.map(async (expense) => {
        const user = await users.findOne({ _id: new ObjectId(expense.userId) });
        return {
          ...expense,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || ''
        };
      })
    );

    return res.status(200).json({
      count: enrichedExpenses.length,
      expenses: enrichedExpenses
    });

  } catch (error) {
    console.error('Error fetching expenses:', error);
    return res.status(500).json({
      error: 'Failed to fetch expenses'
    });
  }
};

// Update expense
updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { date, category, amount, description, receiptUrl } = req.body;

    if (!ObjectId.isValid(expenseId)) {
      return res.status(400).json({
        error: 'Invalid expense ID'
      });
    }

    // Find existing expense
    const existingExpense = await expenses.findOne({ _id: new ObjectId(expenseId) });
    if (!existingExpense) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }

    // Check if the expense's month is finalized
    const expenseMonth = format(existingExpense.date, 'yyyy-MM');
    const finalized = await monthlyFinalization.findOne({ month: expenseMonth });
    if (finalized) {
      return res.status(400).json({
        error: 'Cannot update expense - month is already finalized'
      });
    }

    // Build update object
    const updateData = { updatedAt: new Date() };
    if (date !== undefined) {
      const newDate = new Date(date);
      newDate.setHours(12, 0, 0, 0);
      updateData.date = newDate;
    }
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) updateData.amount = amount;
    if (description !== undefined) updateData.description = description;
    if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl;

    // Update expense
    await expenses.updateOne(
      { _id: new ObjectId(expenseId) },
      { $set: updateData }
    );

    return res.status(200).json({
      message: 'Expense updated successfully'
    });

  } catch (error) {
    console.error('Error updating expense:', error);
    return res.status(500).json({
      error: 'Failed to update expense'
    });
  }
};

// Delete expense
deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    if (!ObjectId.isValid(expenseId)) {
      return res.status(400).json({
        error: 'Invalid expense ID'
      });
    }

    // Find existing expense
    const existingExpense = await expenses.findOne({ _id: new ObjectId(expenseId) });
    if (!existingExpense) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }

    // Check if the expense's month is finalized
    const expenseMonth = format(existingExpense.date, 'yyyy-MM');
    const finalized = await monthlyFinalization.findOne({ month: expenseMonth });
    if (finalized) {
      return res.status(400).json({
        error: 'Cannot delete expense - month is already finalized'
      });
    }

    // Delete expense
    await expenses.deleteOne({ _id: new ObjectId(expenseId) });

    return res.status(200).json({
      message: 'Expense deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting expense:', error);
    return res.status(500).json({
      error: 'Failed to delete expense'
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
  getAllFinalizations,
  getAllDeposits,
  updateDeposit,
  deleteDeposit,
  getAllExpenses,
  updateExpense,
  deleteExpense
}