"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express = require('express');
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const { getAvailableMeals, getTotalMealsForUser, cancelMealRegistration, registerMeal, updateMealRegistration, bulkToggleMealsForUser } = require('./meals.controller');
const router = express.Router();
router.get('/available', verifyFirebaseToken(), getAvailableMeals);
router.post('/register', verifyFirebaseToken(), registerMeal);
router.post('/bulk-register', verifyFirebaseToken(), bulkToggleMealsForUser);
router.patch('/register/:registrationId', verifyFirebaseToken(), updateMealRegistration);
router.delete('/register/cancel/:registrationId', verifyFirebaseToken(), cancelMealRegistration);
router.get('/total/:email', verifyFirebaseToken(), getTotalMealsForUser);
module.exports = router;
