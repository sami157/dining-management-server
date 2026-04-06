"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const express_1 = __importDefault(require("express"));
const verifyFirebaseToken = require("../../middleware/verifyFirebaseToken");
const validateRequest = require("../../middleware/validateRequest");
const authorization_1 = require("../shared/authorization");
const finalization_controller_1 = require("./finalization.controller");
const finalization_validation_1 = require("./finalization.validation");
const router = express_1.default.Router();
router.post('/finalize', verifyFirebaseToken(authorization_1.ROLE_POLICIES.monthFinalizationManagement), validateRequest({ body: finalization_validation_1.finalizeMonthBodySchema }), finalization_controller_1.finalizeMonth);
router.get('/finalization/:month', verifyFirebaseToken(), validateRequest({ params: finalization_validation_1.monthParamsSchema }), finalization_controller_1.getMonthFinalization);
router.get('/user-finalization', verifyFirebaseToken(), validateRequest({ query: finalization_validation_1.currentUserFinalizationQuerySchema }), finalization_controller_1.getMyFinalizationData);
router.get('/finalizations', verifyFirebaseToken(), finalization_controller_1.getAllFinalizations);
router.delete('/finalization/:month', verifyFirebaseToken(authorization_1.ROLE_POLICIES.monthFinalizationManagement), validateRequest({ params: finalization_validation_1.monthParamsSchema }), finalization_controller_1.undoMonthFinalization);
module.exports = router;
