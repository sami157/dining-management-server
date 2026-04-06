import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import {
  finalizeMonth,
  getAllFinalizations,
  getMonthFinalization,
  getMyFinalizationData,
  undoMonthFinalization
} from './finalization.controller';
import {
  currentUserFinalizationQuerySchema,
  finalizeMonthBodySchema,
  monthParamsSchema
} from './finalization.validation';

const router = express.Router();

router.post('/finalize', verifyFirebaseToken(['admin', 'super_admin']), validateRequest({ body: finalizeMonthBodySchema }), finalizeMonth);
router.get('/finalization/:month', verifyFirebaseToken(), validateRequest({ params: monthParamsSchema }), getMonthFinalization);
router.get('/user-finalization', verifyFirebaseToken(), validateRequest({ query: currentUserFinalizationQuerySchema }), getMyFinalizationData);
router.get('/finalizations', verifyFirebaseToken(), getAllFinalizations);
router.delete(
  '/finalization/:month',
  verifyFirebaseToken(['admin', 'super_admin']),
  validateRequest({ params: monthParamsSchema }),
  undoMonthFinalization
);

export = router;
