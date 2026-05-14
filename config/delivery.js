const DELIVERY_LOCATIONS = ['township', 'old_admin'];

const normalizeDeliveryLocation = (deliveryLocation) => String(deliveryLocation || '').trim().toLowerCase();

module.exports = {
  DELIVERY_LOCATIONS,
  normalizeDeliveryLocation,
};
