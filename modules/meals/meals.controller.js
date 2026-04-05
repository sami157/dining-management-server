const {
  getAvailableMealsForUser,
  createMealRegistration,
  editMealRegistration,
  removeMealRegistration,
  getMealTotalsForUser,
  bulkRegisterMealsForUser
} = require('./meals.service');

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);
  return res.status(error.status || 500).json({ error: error.message || fallbackMessage });
};

const getAvailableMeals = async (req, res) => {
  try {
    const result = await getAvailableMealsForUser(req.user?._id, req.query);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, 'Error fetching available meals:');
  }
};

const registerMeal = async (req, res) => {
  try {
    const result = await createMealRegistration(req.body, req.user);
    return res.status(201).json(result);
  } catch (error) {
    return handleError(res, error, 'Error registering meal:');
  }
};

const updateMealRegistration = async (req, res) => {
  try {
    await editMealRegistration(req.params.registrationId, req.body.numberOfMeals, req.user);
    return res.status(200).json({ message: 'Registration updated successfully' });
  } catch (error) {
    return handleError(res, error, 'Error updating meal registration:');
  }
};

const cancelMealRegistration = async (req, res) => {
  try {
    await removeMealRegistration(req.params.registrationId, req.user);
    return res.status(200).json({ message: 'Meal registration cancelled successfully' });
  } catch (error) {
    return handleError(res, error, 'Error cancelling meal registration:');
  }
};

const getTotalMealsForUser = async (req, res) => {
  try {
    const result = await getMealTotalsForUser(req.params.email, req.query.month);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error, 'Error calculating total meals:');
  }
};

const bulkToggleMealsForUser = async (req, res) => {
  try {
    const result = await bulkRegisterMealsForUser(req.query.month, req.user?._id);
    return res.status(result.status).json({
      message: result.message,
      registeredCount: result.registeredCount
    });
  } catch (error) {
    return handleError(res, error, 'Error in bulk toggling:');
  }
};

module.exports = {
  getAvailableMeals,
  registerMeal,
  updateMealRegistration,
  cancelMealRegistration,
  getTotalMealsForUser,
  bulkToggleMealsForUser
};
