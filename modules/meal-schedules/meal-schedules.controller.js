const {
  generateSchedulesForRange,
  listSchedules,
  updateScheduleById,
  deleteScheduleById,
  listRegistrationsForRange
} = require('./meal-schedules.service');

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);
  return res.status(error.status || 500).json({ error: error.message || fallbackMessage });
};

const generateSchedules = async (req, res) => {
  try {
    const result = await generateSchedulesForRange(req.body, req.user?._id);
    return res.status(result.status).json({
      message: result.message,
      count: result.count,
      registrationsCreated: result.registrationsCreated
    });
  } catch (error) {
    return handleError(res, error, 'Error generating schedules:');
  }
};

const getSchedules = async (req, res) => {
  try {
    const result = await listSchedules(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, 'Error fetching schedules:');
  }
};

const updateSchedule = async (req, res) => {
  try {
    const schedule = await updateScheduleById(req.params.scheduleId, req.body);
    return res.status(200).json({ message: 'Schedule and registrations updated successfully', schedule });
  } catch (error) {
    return handleError(res, error, 'Error updating schedule:');
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const result = await deleteScheduleById(req.params.scheduleId);
    return res.status(200).json({
      message: 'Schedule deleted successfully',
      registrationsCleared: result.registrationsCleared
    });
  } catch (error) {
    return handleError(res, error, 'Error deleting schedule:');
  }
};

const getAllRegistrations = async (req, res) => {
  try {
    const result = await listRegistrationsForRange(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, 'Error fetching all registrations:');
  }
};

module.exports = {
  generateSchedules,
  getSchedules,
  updateSchedule,
  deleteSchedule,
  getAllRegistrations
};
