"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const verifyFirebaseToken = require("../../middleware/verifyFirebaseToken");
const validateRequest = require("../../middleware/validateRequest");
const expenses_controller_1 = require("./expenses.controller");
const expenses_validation_1 = require("./expenses.validation");
const router = express_1.default.Router();
router.post('/expenses/add', verifyFirebaseToken(['admin', 'super_admin']), validateRequest({ body: expenses_validation_1.expenseBodyBaseSchema }), expenses_controller_1.addExpense);
router.get('/expenses', verifyFirebaseToken(), validateRequest({ query: expenses_validation_1.expensesQuerySchema }), expenses_controller_1.getAllExpenses);
router.put('/expenses/:expenseId', verifyFirebaseToken(['admin', 'super_admin']), validateRequest({ params: expenses_validation_1.expenseIdParamsSchema, body: expenses_validation_1.updateExpenseBodySchema }), expenses_controller_1.updateExpense);
router.delete('/expenses/:expenseId', verifyFirebaseToken(['admin', 'super_admin']), validateRequest({ params: expenses_validation_1.expenseIdParamsSchema }), expenses_controller_1.deleteExpense);
module.exports = router;
