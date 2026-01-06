const express = require('express');
const { addDeposit, addExpense } = require('./finance.controller');
const router = express.Router();

// POST /managers/finance/deposits
router.post('/deposits/add', addDeposit);
router.post('/expenses/add', addExpense);

module.exports = router;