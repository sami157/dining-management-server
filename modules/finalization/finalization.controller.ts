// @ts-nocheck
const {
  finalizeMonthSummary,
  getFinalizationByMonth,
  getCurrentUserFinalization,
  listFinalizations,
  undoFinalizationByMonth
} = require('./finalization.service');
const { asyncHandler } = require('../shared/controller.utils');

const finalizeMonth = asyncHandler(async (req, res) => {
  const result = await finalizeMonthSummary(req.body.month, req.user?._id);
  return res.status(201).json({
    message: 'Month finalized successfully',
    finalizationId: result.finalizationId,
    summary: result.summary
  });
});

const getMonthFinalization = asyncHandler(async (req, res) => {
  const result = await getFinalizationByMonth(req.params.month);
  return res.status(200).json(result);
});

const getMyFinalizationData = asyncHandler(async (req, res) => {
  const result = await getCurrentUserFinalization(req.user?._id.toString(), req.query.month);
  return res.status(200).json(result);
});

const getAllFinalizations = asyncHandler(async (req, res) => {
  const result = await listFinalizations();
  return res.status(200).json(result);
});

const undoMonthFinalization = asyncHandler(async (req, res) => {
  const result = await undoFinalizationByMonth(req.params.month);
  return res.status(200).json({
    message: `Finalization for ${req.params.month} has been undone successfully`,
    restoredMembers: result.restoredMembers
  });
});

module.exports = {
  finalizeMonth,
  getMonthFinalization,
  getMyFinalizationData,
  getAllFinalizations,
  undoMonthFinalization
};

