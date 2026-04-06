import type { Request, Response } from 'express';
const {
  addDepositForUser,
  getMonthlyDepositForCurrentUser,
  listDeposits,
  updateDepositById,
  deleteDepositById
} = require('./deposits.service');
const { asyncHandler } = require('../shared/controller.utils');

const addDeposit = asyncHandler(async (req: Request, res: Response) => {
  const result = await addDepositForUser(req.body, req.user?._id);
  return res.status(201).json({
    message: 'Deposit added successfully',
    depositId: result.depositId,
    deposit: result.deposit
  });
});

const getMonthlyDepositByUserId = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMonthlyDepositForCurrentUser(req.user?._id?.toString(), req.query.month);
  return res.status(200).json(result);
});

const getAllDeposits = asyncHandler(async (req: Request, res: Response) => {
  const result = await listDeposits(req.query);
  return res.status(200).json(result);
});

const updateDeposit = asyncHandler(async (req: Request, res: Response) => {
  await updateDepositById(req.params.depositId, req.body);
  return res.status(200).json({ message: 'Deposit updated successfully' });
});

const deleteDeposit = asyncHandler(async (req: Request, res: Response) => {
  await deleteDepositById(req.params.depositId);
  return res.status(200).json({ message: 'Deposit deleted successfully' });
});

export {
  addDeposit,
  getMonthlyDepositByUserId,
  getAllDeposits,
  updateDeposit,
  deleteDeposit
};
