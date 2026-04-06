import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import {
  checkUserWithEmail,
  createUser,
  getAllUsers,
  getUserProfile,
  getUserRole,
  updateFixedDeposit,
  updateMosqueFee,
  updateUserProfile,
  updateUserRole
} from './users.controller';
import {
  createUserBodySchema,
  emailParamsSchema,
  listUsersQuerySchema,
  updateFixedDepositBodySchema,
  updateMosqueFeeBodySchema,
  updateUserProfileBodySchema,
  updateUserRoleBodySchema,
  userIdParamsSchema
} from './users.validation';

const router = express.Router();

router.post('/create', verifyFirebaseToken(), validateRequest({ body: createUserBodySchema }), createUser);
router.get('/profile', verifyFirebaseToken(), getUserProfile);
router.put('/profile', verifyFirebaseToken(), validateRequest({ body: updateUserProfileBodySchema }), updateUserProfile);
router.put(
  '/role/:userId',
  verifyFirebaseToken(['admin', 'manager', 'super_admin']),
  validateRequest({ params: userIdParamsSchema, body: updateUserRoleBodySchema }),
  updateUserRole
);
router.put(
  '/fixedDeposit/:userId',
  verifyFirebaseToken(['admin', 'super_admin']),
  validateRequest({ params: userIdParamsSchema, body: updateFixedDepositBodySchema }),
  updateFixedDeposit
);
router.put(
  '/mosqueFee/:userId',
  verifyFirebaseToken(['admin', 'super_admin']),
  validateRequest({ params: userIdParamsSchema, body: updateMosqueFeeBodySchema }),
  updateMosqueFee
);
router.get('/', validateRequest({ query: listUsersQuerySchema }), getAllUsers);
router.get('/get-role/:email', validateRequest({ params: emailParamsSchema }), getUserRole);
router.get('/check-user/:email', validateRequest({ params: emailParamsSchema }), checkUserWithEmail);

export = router;
