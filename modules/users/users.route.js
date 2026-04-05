const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken')
const { createUser, getUserProfile, updateUserProfile, updateUserRole, getAllUsers, getUserRole, updateFixedDeposit, updateMosqueFee, checkUserWithEmail } = require('./users.controller');
const router = express.Router();

// User management
router.post('/create', verifyFirebaseToken(), createUser);
router.get('/profile', verifyFirebaseToken(), getUserProfile);
router.put('/profile', verifyFirebaseToken(), updateUserProfile);
router.put('/role/:userId', verifyFirebaseToken(['admin', 'manager', 'super_admin']), updateUserRole); //admin only access
router.put('/fixedDeposit/:userId', verifyFirebaseToken(['admin', 'super_admin']), updateFixedDeposit); //admin only access
router.put('/mosqueFee/:userId', verifyFirebaseToken(['admin', 'super_admin']), updateMosqueFee); //admin only access
router.get('/', getAllUsers); //admin or manager can access
router.get('/get-role/:email', getUserRole);
router.get('/check-user/:email', checkUserWithEmail)

module.exports = router;
