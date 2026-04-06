import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import {
  addExpense,
  deleteExpense,
  getAllExpenses,
  updateExpense
} from './expenses.controller';
import {
  expenseBodyBaseSchema,
  expenseIdParamsSchema,
  expensesQuerySchema,
  updateExpenseBodySchema
} from './expenses.validation';

const router = express.Router();

router.post('/expenses/add', verifyFirebaseToken(['admin', 'super_admin']), validateRequest({ body: expenseBodyBaseSchema }), addExpense);
router.get('/expenses', verifyFirebaseToken(), validateRequest({ query: expensesQuerySchema }), getAllExpenses);
router.put(
  '/expenses/:expenseId',
  verifyFirebaseToken(['admin', 'super_admin']),
  validateRequest({ params: expenseIdParamsSchema, body: updateExpenseBodySchema }),
  updateExpense
);
router.delete(
  '/expenses/:expenseId',
  verifyFirebaseToken(['admin', 'super_admin']),
  validateRequest({ params: expenseIdParamsSchema }),
  deleteExpense
);

export = router;
