const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const handleControllerError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);
  return res.status(error.status || 500).json({ error: error.message || fallbackMessage });
};

module.exports = {
  createHttpError,
  handleControllerError
};
