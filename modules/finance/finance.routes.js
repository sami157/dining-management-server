const express = require('express');
const { addDeposit, addExpense, getAllBalances, getUserBalance, finalizeMonth, getMonthFinalization, getAllFinalizations } = require('./finance.controller');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken')
const router = express.Router();

// POST /managers/finance/deposits
router.post('/deposits/add', verifyFirebaseToken(), addDeposit);
router.post('/expenses/add', verifyFirebaseToken(), addExpense);
router.get('/balances', getAllBalances);
router.get('/balances/:userId', verifyFirebaseToken(), getUserBalance);
router.post('/finalize', finalizeMonth);
router.get('/finalization/:month', getMonthFinalization);
router.get('/finalizations', getAllFinalizations);

module.exports = router;