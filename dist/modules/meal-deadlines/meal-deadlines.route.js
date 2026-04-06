"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const { getGlobalMealDeadlines, updateGlobalMealDeadlines } = require('./meal-deadlines.controller');
const router = express.Router();
router.get('/', verifyFirebaseToken(), getGlobalMealDeadlines);
router.put('/', verifyFirebaseToken(['admin', 'super_admin']), updateGlobalMealDeadlines);
module.exports = router;
