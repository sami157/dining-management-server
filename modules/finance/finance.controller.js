const { ObjectId } = require('mongodb');
const { deposits, memberBalances, users } = require('../../config/connectMongodb');

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
      userId: userId,
      amount: amount,
      month: month,
      depositDate: depositDate ? new Date(depositDate) : new Date(),
      notes: notes || '',
      addedBy: managerId,
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

module.exports = {
  addDeposit
}