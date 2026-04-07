import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import { ROLE_POLICIES } from '../shared/authorization';
import {
  getAllBalances,
  getMyBalance,
  getUserBalance
} from './balances.controller';
import { userIdParamsSchema } from './balances.validation';

const router = express.Router();

router.get('/balances', verifyFirebaseToken(ROLE_POLICIES.memberFinanceManagement), getAllBalances);
router.get('/balances/:userId', verifyFirebaseToken(ROLE_POLICIES.memberFinanceManagement), validateRequest({ params: userIdParamsSchema }), getUserBalance);
router.get('/my-balance', verifyFirebaseToken(), getMyBalance);

export = router;
