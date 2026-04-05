const {
  addDepositForUser,
  getMonthlyDepositForCurrentUser,
  listDeposits,
  updateDepositById,
  deleteDepositById
} = require('./deposits.service');
const { handleControllerError } = require('../finance/finance.utils');

const addDeposit = async (req, res) => {
  try {
    const result = await addDepositForUser(req.body, req.user?._id);
    return res.status(201).json({
      message: 'Deposit added successfully',
      depositId: result.depositId,
      deposit: result.deposit
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error adding deposit:');
  }
};

const getMonthlyDepositByUserId = async (req, res) => {
  try {
    const result = await getMonthlyDepositForCurrentUser(req.user?._id.toString(), req.query.month);
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Error fetching user balance:');
  }
};

const getAllDeposits = async (req, res) => {
  try {
    const result = await listDeposits(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Error fetching deposits:');
  }
};

const updateDeposit = async (req, res) => {
  try {
    await updateDepositById(req.params.depositId, req.body);
    return res.status(200).json({ message: 'Deposit updated successfully' });
  } catch (error) {
    return handleControllerError(res, error, 'Error updating deposit:');
  }
};

const deleteDeposit = async (req, res) => {
  try {
    await deleteDepositById(req.params.depositId);
    return res.status(200).json({ message: 'Deposit deleted successfully' });
  } catch (error) {
    return handleControllerError(res, error, 'Error deleting deposit:');
  }
};

module.exports = {
  addDeposit,
  getMonthlyDepositByUserId,
  getAllDeposits,
  updateDeposit,
  deleteDeposit
};
