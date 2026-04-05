const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const {
  getAllBalances,
  getUserBalance,
  getMyBalance
} = require('./balances.controller');

const router = express.Router();

router.get('/balances', getAllBalances);
router.get('/balances/:userId', getUserBalance);
router.get('/my-balance', verifyFirebaseToken(), getMyBalance);

module.exports = router;
