// @ts-nocheck
const {
  addDepositForUser,
  getMonthlyDepositForCurrentUser,
  listDeposits,
  updateDepositById,
  deleteDepositById
} = require('./deposits.service');
const { asyncHandler } = require('../shared/controller.utils');

const addDeposit = asyncHandler(async (req, res) => {
  const result = await addDepositForUser(req.body, req.user?._id);
  return res.status(201).json({
    message: 'Deposit added successfully',
    depositId: result.depositId,
    deposit: result.deposit
  });
});

const getMonthlyDepositByUserId = asyncHandler(async (req, res) => {
  const result = await getMonthlyDepositForCurrentUser(req.user?._id.toString(), req.query.month);
  return res.status(200).json(result);
});

const getAllDeposits = asyncHandler(async (req, res) => {
  const result = await listDeposits(req.query);
  return res.status(200).json(result);
});

const updateDeposit = asyncHandler(async (req, res) => {
  await updateDepositById(req.params.depositId, req.body);
  return res.status(200).json({ message: 'Deposit updated successfully' });
});

const deleteDeposit = asyncHandler(async (req, res) => {
  await deleteDepositById(req.params.depositId);
  return res.status(200).json({ message: 'Deposit deleted successfully' });
});

module.exports = {
  addDeposit,
  getMonthlyDepositByUserId,
  getAllDeposits,
  updateDeposit,
  deleteDeposit
};

