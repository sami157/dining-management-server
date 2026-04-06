// @ts-nocheck
const express = require('express');
const router = express.Router();
const depositsRouter = require('../deposits/deposits.route');
const expensesRouter = require('../expenses/expenses.route');
const balancesRouter = require('./balances.route');
const finalizationRouter = require('../finalization/finalization.route');
const statsRouter = require('../stats/stats.route');

router.use(depositsRouter);
router.use(expensesRouter);
router.use(balancesRouter);
router.use(finalizationRouter);
router.use(statsRouter);

module.exports = router;

