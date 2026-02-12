const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken')
const router = express.Router();
const { 
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
} = require('./finance.controller');

// Deposits
router.post('/deposits/add', verifyFirebaseToken(), addDeposit);
router.get('/deposits', verifyFirebaseToken(), getAllDeposits);
router.put('/deposits/:depositId', verifyFirebaseToken(), updateDeposit);
router.delete('/deposits/:depositId', verifyFirebaseToken(), deleteDeposit);

// Expenses
router.post('/expenses/add', verifyFirebaseToken(), addExpense);
router.get('/expenses', verifyFirebaseToken(), getAllExpenses);
router.put('/expenses/:expenseId', verifyFirebaseToken(), updateExpense);
router.delete('/expenses/:expenseId', verifyFirebaseToken(), deleteExpense);

// Balances
router.get('/balances', getAllBalances);
router.get('/balances/:userId', getUserBalance);

// Finalization
router.post('/finalize', verifyFirebaseToken(), finalizeMonth);
router.get('/finalization/:month', verifyFirebaseToken(), getMonthFinalization);
router.get('/finalizations', verifyFirebaseToken(), getAllFinalizations);

module.exports = router;