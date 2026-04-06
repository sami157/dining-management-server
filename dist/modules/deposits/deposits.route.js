"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const verifyFirebaseToken = require("../../middleware/verifyFirebaseToken");
const validateRequest = require("../../middleware/validateRequest");
const authorization_1 = require("../shared/authorization");
const deposits_controller_1 = require("./deposits.controller");
const deposits_validation_1 = require("./deposits.validation");
const router = express_1.default.Router();
router.post('/deposits/add', verifyFirebaseToken(authorization_1.ROLE_POLICIES.depositManagement), validateRequest({ body: deposits_validation_1.addDepositBodySchema }), deposits_controller_1.addDeposit);
router.get('/deposits', verifyFirebaseToken(), validateRequest({ query: deposits_validation_1.depositsQuerySchema }), deposits_controller_1.getAllDeposits);
router.get('/user-deposit', verifyFirebaseToken(), validateRequest({ query: deposits_validation_1.currentUserDepositQuerySchema }), deposits_controller_1.getMonthlyDepositByUserId);
router.put('/deposits/:depositId', verifyFirebaseToken(authorization_1.ROLE_POLICIES.depositManagement), validateRequest({ params: deposits_validation_1.depositIdParamsSchema, body: deposits_validation_1.updateDepositBodySchema }), deposits_controller_1.updateDeposit);
router.delete('/deposits/:depositId', verifyFirebaseToken(authorization_1.ROLE_POLICIES.depositManagement), validateRequest({ params: deposits_validation_1.depositIdParamsSchema }), deposits_controller_1.deleteDeposit);
module.exports = router;
