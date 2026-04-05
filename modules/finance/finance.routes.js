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
  undoMonthFinalization,
  getMyBalance
} = require('./finance.controller');

// Deposits
router.post('/deposits/add', verifyFirebaseToken(['admin', 'super_admin']), addDeposit);
router.get('/deposits', verifyFirebaseToken(), getAllDeposits);
router.get('/user-deposit', verifyFirebaseToken(), getMonthlyDepositByUserId);
router.put('/deposits/:depositId', verifyFirebaseToken(['admin', 'super_admin']), updateDeposit);
router.delete('/deposits/:depositId', verifyFirebaseToken(['admin', 'super_admin']), deleteDeposit);

// Expenses
router.post('/expenses/add', verifyFirebaseToken(['admin', 'super_admin']), addExpense);
router.get('/expenses', verifyFirebaseToken(), getAllExpenses);
router.put('/expenses/:expenseId', verifyFirebaseToken(['admin', 'super_admin']), updateExpense);
router.delete('/expenses/:expenseId', verifyFirebaseToken(['admin', 'super_admin']), deleteExpense);

// Balances
router.get('/balances', getAllBalances);
router.get('/balances/:userId', getUserBalance);
router.get('/my-balance', verifyFirebaseToken(), getMyBalance);

//Running Meal Rate
router.get('/meal-rate', verifyFirebaseToken(), getRunningMealRate);

// Finalization
router.post('/finalize', verifyFirebaseToken(['admin', 'super_admin']), finalizeMonth);
router.get('/finalization/:month', verifyFirebaseToken(), getMonthFinalization);
router.get('/user-finalization', verifyFirebaseToken(), getMyFinalizationData);
router.get('/finalizations', verifyFirebaseToken(), getAllFinalizations);
router.delete('/finalization/:month', verifyFirebaseToken(['admin', 'super_admin']), undoMonthFinalization);

module.exports = router;
