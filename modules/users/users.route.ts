import express from 'express';
import verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
import validateRequest = require('../../middleware/validateRequest');
import { ROLE_POLICIES } from '../shared/authorization';
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

router.post('/create', verifyFirebaseToken([], { allowMissingUser: true }), validateRequest({ body: createUserBodySchema }), createUser);
router.get('/profile', verifyFirebaseToken(), getUserProfile);
router.put('/profile', verifyFirebaseToken(), validateRequest({ body: updateUserProfileBodySchema }), updateUserProfile);
router.put(
  '/role/:userId',
  verifyFirebaseToken(ROLE_POLICIES.userRoleManagement),
  validateRequest({ params: userIdParamsSchema, body: updateUserRoleBodySchema }),
  updateUserRole
);
router.put(
  '/fixedDeposit/:userId',
  verifyFirebaseToken(ROLE_POLICIES.memberFinanceManagement),
  validateRequest({ params: userIdParamsSchema, body: updateFixedDepositBodySchema }),
  updateFixedDeposit
);
router.put(
  '/mosqueFee/:userId',
  verifyFirebaseToken(ROLE_POLICIES.memberFinanceManagement),
  validateRequest({ params: userIdParamsSchema, body: updateMosqueFeeBodySchema }),
  updateMosqueFee
);
router.get('/', validateRequest({ query: listUsersQuerySchema }), getAllUsers);
router.get('/get-role/:email', validateRequest({ params: emailParamsSchema }), getUserRole);
router.get('/check-user/:email', validateRequest({ params: emailParamsSchema }), checkUserWithEmail);

export = router;
