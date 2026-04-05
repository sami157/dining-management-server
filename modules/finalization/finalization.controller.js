const {
  finalizeMonthSummary,
  getFinalizationByMonth,
  getCurrentUserFinalization,
  listFinalizations,
  undoFinalizationByMonth
} = require('./finalization.service');
const { handleControllerError } = require('../finance/finance.utils');

const finalizeMonth = async (req, res) => {
  try {
    const result = await finalizeMonthSummary(req.body.month, req.user?._id);
    return res.status(201).json({
      message: 'Month finalized successfully',
      finalizationId: result.finalizationId,
      summary: result.summary
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error finalizing month:');
  }
};

const getMonthFinalization = async (req, res) => {
  try {
    const result = await getFinalizationByMonth(req.params.month);
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Error fetching finalization:');
  }
};

const getMyFinalizationData = async (req, res) => {
  try {
    const result = await getCurrentUserFinalization(req.user?._id.toString(), req.query.month);
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Error fetching user finalization data:');
  }
};

const getAllFinalizations = async (req, res) => {
  try {
    const result = await listFinalizations();
    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Error fetching finalizations:');
  }
};

const undoMonthFinalization = async (req, res) => {
  try {
    const result = await undoFinalizationByMonth(req.params.month);
    return res.status(200).json({
      message: `Finalization for ${req.params.month} has been undone successfully`,
      restoredMembers: result.restoredMembers
    });
  } catch (error) {
    return handleControllerError(res, error, 'Error undoing month finalization:');
  }
};

module.exports = {
  finalizeMonth,
  getMonthFinalization,
  getMyFinalizationData,
  getAllFinalizations,
  undoMonthFinalization
};
