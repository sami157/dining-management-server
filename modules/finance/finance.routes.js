const express = require('express');
const { addDeposit } = require('./finance.controller');
const router = express.Router();

// POST /managers/finance/deposits
router.post('/deposits/add', addDeposit);

module.exports = router;