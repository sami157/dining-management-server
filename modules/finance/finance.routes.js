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
router.post('/deposits/add', addDeposit);
router.get('/deposits', getAllDeposits);
router.put('/deposits/:depositId', updateDeposit);
router.delete('/deposits/:depositId', deleteDeposit);

// Expenses
router.post('/expenses/add', addExpense);
router.get('/expenses', getAllExpenses);
router.put('/expenses/:expenseId', updateExpense);
router.delete('/expenses/:expenseId', deleteExpense);

// Balances
router.get('/balances', getAllBalances);
router.get('/balances/:userId', getUserBalance);

// Finalization
router.post('/finalize', finalizeMonth);
router.get('/finalization/:month', getMonthFinalization);
router.get('/finalizations', getAllFinalizations);

module.exports = router;