const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken')
const { getAvailableMeals, getTotalMealsForUser, cancelMealRegistration, registerMeal } = require('./users.controller');
const { createUser, getUserProfile, updateUserProfile, updateUserRole, getAllUsers, getUserRole } = require('./users.management.controller');
const router = express.Router();

// User management
router.post('/create', createUser);
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.put('/role/:userId', verifyFirebaseToken(), updateUserRole); //admin only access
router.get('/', verifyFirebaseToken(), getAllUsers); //admin or manager can access
router.get('/get-role/:email', getUserRole);

// get all available meals
router.get('/meals/available', verifyFirebaseToken(), getAvailableMeals);

// register for a meal
router.post('/meals/register', verifyFirebaseToken(), registerMeal);

// cancel a registration
router.delete('/meals/register/cancel/:registrationId', verifyFirebaseToken(), cancelMealRegistration);


// total meals of a user by month
router.get('/meals/total/:email', verifyFirebaseToken(), getTotalMealsForUser);

module.exports = router;