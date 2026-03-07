const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken')
const router = express.Router();
const { 
  addDeposit, 
  addExpense, 
  getAllBalances, 
  getUserBalance,
  getRunningMealRate,
  finalizeMonth,
  getMonthFinalization,
  getAllFinalizations,
  getAllDeposits,
  updateDeposit,
  deleteDeposit,
  getAllExpenses,
  updateExpense,
  deleteExpense,
  getMonthlyDepositByUserId,
  getMyFinalizationData,
  undoMonthFinalization
} = require('./finance.controller');

// Deposits
router.post('/deposits/add', verifyFirebaseToken(true), addDeposit);
router.get('/deposits', verifyFirebaseToken(), getAllDeposits);
router.get('/user-deposit', verifyFirebaseToken(), getMonthlyDepositByUserId);
router.put('/deposits/:depositId', verifyFirebaseToken(true), updateDeposit);
router.delete('/deposits/:depositId', verifyFirebaseToken(true), deleteDeposit);

// Expenses
router.post('/expenses/add', verifyFirebaseToken(true), addExpense);
router.get('/expenses', verifyFirebaseToken(), getAllExpenses);
router.put('/expenses/:expenseId', verifyFirebaseToken(true), updateExpense);
router.delete('/expenses/:expenseId', verifyFirebaseToken(true), deleteExpense);

// Balances
router.get('/balances', getAllBalances);
router.get('/balances/:userId', getUserBalance);

//Running Meal Rate
router.get('/meal-rate', verifyFirebaseToken(), getRunningMealRate);

// Finalization
router.post('/finalize', verifyFirebaseToken(true), finalizeMonth);
router.get('/finalization/:month', verifyFirebaseToken(), getMonthFinalization);
router.get('/user-finalization', verifyFirebaseToken(), getMyFinalizationData);
router.get('/finalizations', verifyFirebaseToken(), getAllFinalizations);
router.delete('/finalization/:month', verifyFirebaseToken(true), undoMonthFinalization);

module.exports = router;