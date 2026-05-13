const DINING_IDS = ['township', 'office'];
const DEFAULT_DINING_ID = 'township';

const normalizeDiningId = (diningId = DEFAULT_DINING_ID) => String(diningId).trim().toLowerCase();

const isValidDiningId = (diningId) => DINING_IDS.includes(normalizeDiningId(diningId));

const getMealDefaultField = (diningId = DEFAULT_DINING_ID) => (
  normalizeDiningId(diningId) === 'office' ? 'mealDefaultOffice' : 'mealDefault'
);

module.exports = {
  DINING_IDS,
  DEFAULT_DINING_ID,
  normalizeDiningId,
  isValidDiningId,
  getMealDefaultField,
};
