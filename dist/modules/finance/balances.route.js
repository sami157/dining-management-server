"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const verifyFirebaseToken = require("../../middleware/verifyFirebaseToken");
const validateRequest = require("../../middleware/validateRequest");
const balances_controller_1 = require("./balances.controller");
const balances_validation_1 = require("./balances.validation");
const router = express_1.default.Router();
router.get('/balances', balances_controller_1.getAllBalances);
router.get('/balances/:userId', validateRequest({ params: balances_validation_1.userIdParamsSchema }), balances_controller_1.getUserBalance);
router.get('/my-balance', verifyFirebaseToken(), balances_controller_1.getMyBalance);
module.exports = router;
