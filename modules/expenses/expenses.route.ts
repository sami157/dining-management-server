import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import { ROLE_POLICIES } from '../shared/authorization';
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

router.post('/expenses/add', verifyFirebaseToken(ROLE_POLICIES.expenseManagement), validateRequest({ body: expenseBodyBaseSchema }), addExpense);
router.get('/expenses', verifyFirebaseToken(), validateRequest({ query: expensesQuerySchema }), getAllExpenses);
router.put(
  '/expenses/:expenseId',
  verifyFirebaseToken(ROLE_POLICIES.expenseManagement),
  validateRequest({ params: expenseIdParamsSchema, body: updateExpenseBodySchema }),
  updateExpense
);
router.delete(
  '/expenses/:expenseId',
  verifyFirebaseToken(ROLE_POLICIES.expenseManagement),
  validateRequest({ params: expenseIdParamsSchema }),
  deleteExpense
);

export = router;
