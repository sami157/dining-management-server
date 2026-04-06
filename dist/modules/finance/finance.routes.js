"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const balancesRouter = require("./balances.route");
const depositsRouter = require("../deposits/deposits.route");
const expensesRouter = require("../expenses/expenses.route");
const finalizationRouter = require("../finalization/finalization.route");
const statsRouter = require("../stats/stats.route");
const router = express_1.default.Router();
router.use(depositsRouter);
router.use(expensesRouter);
router.use(balancesRouter);
router.use(finalizationRouter);
router.use(statsRouter);
module.exports = router;
