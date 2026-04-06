import express from 'express';
import balancesRouter = require('./balances.route');
import depositsRouter = require('../deposits/deposits.route');
import expensesRouter = require('../expenses/expenses.route');
import finalizationRouter = require('../finalization/finalization.route');
import statsRouter = require('../stats/stats.route');

const router = express.Router();

router.use(depositsRouter);
router.use(expensesRouter);
router.use(balancesRouter);
router.use(finalizationRouter);
router.use(statsRouter);

export = router;
