import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
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

router.post('/deposits/add', verifyFirebaseToken(['admin', 'super_admin']), validateRequest({ body: addDepositBodySchema }), addDeposit);
router.get('/deposits', verifyFirebaseToken(), validateRequest({ query: depositsQuerySchema }), getAllDeposits);
router.get('/user-deposit', verifyFirebaseToken(), validateRequest({ query: currentUserDepositQuerySchema }), getMonthlyDepositByUserId);
router.put(
  '/deposits/:depositId',
  verifyFirebaseToken(['admin', 'super_admin']),
  validateRequest({ params: depositIdParamsSchema, body: updateDepositBodySchema }),
  updateDeposit
);
router.delete(
  '/deposits/:depositId',
  verifyFirebaseToken(['admin', 'super_admin']),
  validateRequest({ params: depositIdParamsSchema }),
  deleteDeposit
);

export = router;
