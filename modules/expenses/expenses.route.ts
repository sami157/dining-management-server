// @ts-nocheck
const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const {
  addExpense,
  getAllExpenses,
  updateExpense,
  deleteExpense
} = require('./expenses.controller');

const router = express.Router();

router.post('/expenses/add', verifyFirebaseToken(['admin', 'super_admin']), addExpense);
router.get('/expenses', verifyFirebaseToken(), getAllExpenses);
router.put('/expenses/:expenseId', verifyFirebaseToken(['admin', 'super_admin']), updateExpense);
router.delete('/expenses/:expenseId', verifyFirebaseToken(['admin', 'super_admin']), deleteExpense);

module.exports = router;

