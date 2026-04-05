const {
  listBalances,
  getBalanceByUserId,
  getBalanceForCurrentUser
} = require('./balances.service');
const { handleControllerError } = require('./finance.utils');

const getAllBalances = async (req, res) => {
  try {
    const result = await listBalances();
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Error fetching balances:');
  }
};

const getUserBalance = async (req, res) => {
  try {
    const result = await getBalanceByUserId(req.params.userId);
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Error fetching user balance:');
  }
};

const getMyBalance = async (req, res) => {
  try {
    const result = await getBalanceForCurrentUser(req.user?._id);
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Error fetching user balance:');
  }
};

module.exports = {
  getAllBalances,
  getUserBalance,
  getMyBalance
};
