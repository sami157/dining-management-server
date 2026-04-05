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

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);
  return res.status(error.status || 500).json({ error: error.message || fallbackMessage });
};

const createUser = async (req, res) => {
  try {
    const result = await registerOrSyncUser(req.body, req.firebaseUser);
    return res.status(result.status).json({
      message: result.message,
      userId: result.userId,
      user: result.user
    });
  } catch (error) {
    return handleError(res, error, 'Error creating user:');
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await getUserProfileByEmail(req.user?.email);
    return res.status(200).json({ user });
  } catch (error) {
    return handleError(res, error, 'Error fetching user profile:');
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const user = await updateUserProfileByEmail(req.user?.email, req.body);
    return res.status(200).json({ message: 'Profile updated successfully', user });
  } catch (error) {
    return handleError(res, error, 'Error updating user profile:');
  }
};

const updateUserRole = async (req, res) => {
  try {
    const user = await updateUserRoleById(req.params.userId, req.body.role, req.user?.role);
    return res.status(200).json({ message: 'User role updated successfully', user });
  } catch (error) {
    return handleError(res, error, 'Error updating user role:');
  }
};

const updateFixedDeposit = async (req, res) => {
  try {
    const user = await updateFixedDepositByUserId(req.params.userId, req.body.fixedDeposit, req.user?.role);
    return res.status(200).json({ message: 'Fixed Deposit Amount updated successfully', user });
  } catch (error) {
    return handleError(res, error, 'Error updating fixed deposit amount:');
  }
};

const updateMosqueFee = async (req, res) => {
  try {
    const user = await updateMosqueFeeByUserId(req.params.userId, req.body.mosqueFee, req.user?.role);
    return res.status(200).json({ message: 'Mosque Fee updated successfully', user });
  } catch (error) {
    return handleError(res, error, 'Error updating mosque fee:');
  }
};

const getAllUsers = async (req, res) => {
  try {
    const result = await listUsers(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, 'Error fetching all users:');
  }
};

const getUserRole = async (req, res) => {
  try {
    const result = await getRoleByEmail(req.params.email);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, 'Error fetching user role:');
  }
};

const checkUserWithEmail = async (req, res) => {
  try {
    const result = await checkUserExistsByEmail(req.params.email);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, 'Error checking user with email:');
  }
};

module.exports = {
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
