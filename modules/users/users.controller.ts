import type { Request, Response } from 'express';
const {
  registerOrSyncUser,
  getUserProfileByEmail,
  updateUserProfileByEmail,
  updateUserRoleById,
  updateFixedDepositByUserId,
  updateMosqueFeeByUserId,
  listUsers,
  getRoleByEmail,
  checkUserExistsByEmail
} = require('./users.service');
const { asyncHandler } = require('../shared/controller.utils');

const createUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerOrSyncUser(req.body, req.firebaseUser);
  return res.status(result.status).json({
    message: result.message,
    userId: result.userId,
    user: result.user
  });
});

const getUserProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserProfileByEmail(req.user?.email);
  return res.status(200).json({ user });
});

const updateUserProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateUserProfileByEmail(req.user?.email, req.body);
  return res.status(200).json({ message: 'Profile updated successfully', user });
});

const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateUserRoleById(req.params.userId, req.body.role, req.user?.role);
  return res.status(200).json({ message: 'User role updated successfully', user });
});

const updateFixedDeposit = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateFixedDepositByUserId(req.params.userId, req.body.fixedDeposit, req.user?.role);
  return res.status(200).json({ message: 'Fixed Deposit Amount updated successfully', user });
});

const updateMosqueFee = asyncHandler(async (req: Request, res: Response) => {
  const user = await updateMosqueFeeByUserId(req.params.userId, req.body.mosqueFee, req.user?.role);
  return res.status(200).json({ message: 'Mosque Fee updated successfully', user });
});

const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await listUsers(req.query);
  return res.status(200).json(result);
});

const getUserRole = asyncHandler(async (req: Request, res: Response) => {
  const result = await getRoleByEmail(req.params.email);
  return res.status(200).json(result);
});

const checkUserWithEmail = asyncHandler(async (req: Request, res: Response) => {
  const result = await checkUserExistsByEmail(req.params.email);
  return res.status(200).json(result);
});

export {
  createUser,
  getUserProfile,
  updateUserProfile,
  updateUserRole,
  updateFixedDeposit,
  updateMosqueFee,
  getAllUsers,
  getUserRole,
  checkUserWithEmail
};
