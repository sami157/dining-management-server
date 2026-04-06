"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUserWithEmail = exports.getUserRole = exports.getAllUsers = exports.updateMosqueFee = exports.updateFixedDeposit = exports.updateUserRole = exports.updateUserProfile = exports.getUserProfile = exports.createUser = void 0;
const { registerOrSyncUser, getUserProfileByEmail, updateUserProfileByEmail, updateUserRoleById, updateFixedDepositByUserId, updateMosqueFeeByUserId, listUsers, getRoleByEmail, checkUserExistsByEmail } = require('./users.service');
const { asyncHandler } = require('../shared/controller.utils');
const createUser = asyncHandler(async (req, res) => {
    const result = await registerOrSyncUser(req.body, req.firebaseUser);
    return res.status(result.status).json({
        message: result.message,
        userId: result.userId,
        user: result.user
    });
});
exports.createUser = createUser;
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await getUserProfileByEmail(req.user?.email);
    return res.status(200).json({ user });
});
exports.getUserProfile = getUserProfile;
const updateUserProfile = asyncHandler(async (req, res) => {
    const user = await updateUserProfileByEmail(req.user?.email, req.body);
    return res.status(200).json({ message: 'Profile updated successfully', user });
});
exports.updateUserProfile = updateUserProfile;
const updateUserRole = asyncHandler(async (req, res) => {
    const user = await updateUserRoleById(req.params.userId, req.body.role, req.user?.role);
    return res.status(200).json({ message: 'User role updated successfully', user });
});
exports.updateUserRole = updateUserRole;
const updateFixedDeposit = asyncHandler(async (req, res) => {
    const user = await updateFixedDepositByUserId(req.params.userId, req.body.fixedDeposit, req.user?.role);
    return res.status(200).json({ message: 'Fixed Deposit Amount updated successfully', user });
});
exports.updateFixedDeposit = updateFixedDeposit;
const updateMosqueFee = asyncHandler(async (req, res) => {
    const user = await updateMosqueFeeByUserId(req.params.userId, req.body.mosqueFee, req.user?.role);
    return res.status(200).json({ message: 'Mosque Fee updated successfully', user });
});
exports.updateMosqueFee = updateMosqueFee;
const getAllUsers = asyncHandler(async (req, res) => {
    const result = await listUsers(req.query);
    return res.status(200).json(result);
});
exports.getAllUsers = getAllUsers;
const getUserRole = asyncHandler(async (req, res) => {
    const result = await getRoleByEmail(req.params.email);
    return res.status(200).json(result);
});
exports.getUserRole = getUserRole;
const checkUserWithEmail = asyncHandler(async (req, res) => {
    const result = await checkUserExistsByEmail(req.params.email);
    return res.status(200).json(result);
});
exports.checkUserWithEmail = checkUserWithEmail;
