const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const { getRunningMealRate } = require('./stats.controller');

const router = express.Router();

router.get('/meal-rate', verifyFirebaseToken(), getRunningMealRate);

module.exports = router;
