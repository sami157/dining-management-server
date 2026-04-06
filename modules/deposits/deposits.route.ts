// @ts-nocheck
const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const {
  addDeposit,
  getMonthlyDepositByUserId,
  getAllDeposits,
  updateDeposit,
  deleteDeposit
} = require('./deposits.controller');

const router = express.Router();

router.post('/deposits/add', verifyFirebaseToken(['admin', 'super_admin']), addDeposit);
router.get('/deposits', verifyFirebaseToken(), getAllDeposits);
router.get('/user-deposit', verifyFirebaseToken(), getMonthlyDepositByUserId);
router.put('/deposits/:depositId', verifyFirebaseToken(['admin', 'super_admin']), updateDeposit);
router.delete('/deposits/:depositId', verifyFirebaseToken(['admin', 'super_admin']), deleteDeposit);

module.exports = router;

