"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const { finalizeMonth, getMonthFinalization, getMyFinalizationData, getAllFinalizations, undoMonthFinalization } = require('./finalization.controller');
const router = express.Router();
router.post('/finalize', verifyFirebaseToken(['admin', 'super_admin']), finalizeMonth);
router.get('/finalization/:month', verifyFirebaseToken(), getMonthFinalization);
router.get('/user-finalization', verifyFirebaseToken(), getMyFinalizationData);
router.get('/finalizations', verifyFirebaseToken(), getAllFinalizations);
router.delete('/finalization/:month', verifyFirebaseToken(['admin', 'super_admin']), undoMonthFinalization);
module.exports = router;
