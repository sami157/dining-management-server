const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken')
const { getAvailableMeals } = require('./users.controller');
const { registerMeal } = require('./users.controller');
const { cancelMealRegistration } = require('./users.controller');
const { getMyRegistrations } = require('./users.controller');
const { createUser, getUserProfile, updateUserProfile } = require('./users.management.controller');
const router = express.Router();

// User management
router.post('/create', createUser);
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.put('/:userId/role', updateUserRole); //admin only access
router.get('/', getAllUsers); //admin or manager can access

// get all available meals
router.get('/meals/available', verifyFirebaseToken(), getAvailableMeals);

// register for a meal
router.post('/meals/register', verifyFirebaseToken(), registerMeal);

// cancel a registration
router.delete('/meals/register/cancel/:registrationId', verifyFirebaseToken(), cancelMealRegistration);

// get registered meals for a user
router.get('/meals/my-registrations', verifyFirebaseToken(), getMyRegistrations);

module.exports = router;