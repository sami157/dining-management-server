import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import { ROLE_POLICIES } from '../shared/authorization';
import {
  addDeposit,
  deleteDeposit,
  getAllDeposits,
  getMonthlyDepositByUserId,
  updateDeposit
} from './deposits.controller';
import {
  addDepositBodySchema,
  currentUserDepositQuerySchema,
  depositIdParamsSchema,
  depositsQuerySchema,
  updateDepositBodySchema
} from './deposits.validation';

const router = express.Router();

router.post('/deposits/add', verifyFirebaseToken(ROLE_POLICIES.depositManagement), validateRequest({ body: addDepositBodySchema }), addDeposit);
router.get('/deposits', verifyFirebaseToken(), validateRequest({ query: depositsQuerySchema }), getAllDeposits);
router.get('/user-deposit', verifyFirebaseToken(), validateRequest({ query: currentUserDepositQuerySchema }), getMonthlyDepositByUserId);
router.put(
  '/deposits/:depositId',
  verifyFirebaseToken(ROLE_POLICIES.depositManagement),
  validateRequest({ params: depositIdParamsSchema, body: updateDepositBodySchema }),
  updateDeposit
);
router.delete(
  '/deposits/:depositId',
  verifyFirebaseToken(ROLE_POLICIES.depositManagement),
  validateRequest({ params: depositIdParamsSchema }),
  deleteDeposit
);

export = router;
