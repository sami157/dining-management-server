// @ts-nocheck
const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken')
const { createUser, getUserProfile, updateUserProfile, updateUserRole, getAllUsers, getUserRole, updateFixedDeposit, updateMosqueFee, checkUserWithEmail } = require('./users.controller');
const router = express.Router();

// User management
router.post('/create', verifyFirebaseToken(), createUser);
router.get('/profile', verifyFirebaseToken(), getUserProfile);
router.put('/profile', verifyFirebaseToken(), updateUserProfile);
router.put('/role/:userId', verifyFirebaseToken(['admin', 'manager', 'super_admin']), updateUserRole);
router.put('/fixedDeposit/:userId', verifyFirebaseToken(['admin', 'super_admin']), updateFixedDeposit);
router.put('/mosqueFee/:userId', verifyFirebaseToken(['admin', 'super_admin']), updateMosqueFee);
router.get('/', getAllUsers);
router.get('/get-role/:email', getUserRole);
router.get('/check-user/:email', checkUserWithEmail)

module.exports = router;

