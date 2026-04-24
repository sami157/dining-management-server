const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const requireRole = require('../../middleware/requireRole');
const { createRecoveryCode, recoverPassword } = require('./auth.controller');

const router = express.Router();

router.post('/admin/create-recovery-code', verifyFirebaseToken(), requireRole('super_admin'), createRecoveryCode);
router.post('/recover-password', recoverPassword);

module.exports = router;
