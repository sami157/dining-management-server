import { DateTime } from 'luxon';

const BUSINESS_TIMEZONE = 'Asia/Dhaka';

const getDateTimeInBusinessTimezone = (value?: Date | string | null) => {
  if (!value) {
    return DateTime.now().setZone(BUSINESS_TIMEZONE);
  }

  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(BUSINESS_TIMEZONE);
  }

  if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) {
    return DateTime.fromISO(value, { zone: BUSINESS_TIMEZONE });
  }

  return DateTime.fromISO(value, { zone: 'utc' }).setZone(BUSINESS_TIMEZONE);
};

const formatServiceDate = (value?: Date | string | null) => {
  return getDateTimeInBusinessTimezone(value).toFormat('yyyy-LL-dd');
};

const getCurrentServiceDate = () => {
  return formatServiceDate();
};

const serviceDateToLegacyDate = (serviceDate: string) => {
  return new Date(`${serviceDate}T00:00:00.000Z`);
};

const serviceDateToBusinessDayStartUtc = (serviceDate: string) => {
  return DateTime.fromISO(serviceDate, { zone: BUSINESS_TIMEZONE })
    .startOf('day')
    .toUTC()
    .toJSDate();
};

const serviceDateToBusinessDayEndUtc = (serviceDate: string) => {
  return DateTime.fromISO(serviceDate, { zone: BUSINESS_TIMEZONE })
    .endOf('day')
    .toUTC()
    .toJSDate();
};

const getMonthServiceDateRange = (month: string) => {
  const start = DateTime.fromISO(`${month}-01`, { zone: BUSINESS_TIMEZONE }).startOf('month');
  const end = start.endOf('month');

  return {
    startServiceDate: start.toFormat('yyyy-LL-dd'),
    endServiceDate: end.toFormat('yyyy-LL-dd')
  };
};

const getLegacyRangeFromServiceDates = (startServiceDate: string, endServiceDate: string) => {
  return {
    startDate: serviceDateToLegacyDate(startServiceDate),
    endDate: serviceDateToLegacyDate(endServiceDate)
  };
};

const buildServiceDateEqualityQuery = (legacyField: string, serviceDate: string) => {
  return {
    $or: [
      { serviceDate },
      { [legacyField]: serviceDateToLegacyDate(serviceDate) }
    ]
  };
};

const buildServiceDateRangeQuery = (legacyField: string, startServiceDate: string, endServiceDate: string) => {
  const { startDate, endDate } = getLegacyRangeFromServiceDates(startServiceDate, endServiceDate);

  return {
    $or: [
      { serviceDate: { $gte: startServiceDate, $lte: endServiceDate } },
      { [legacyField]: { $gte: startDate, $lte: endDate } }
    ]
  };
};

const getServiceMonth = (value?: Date | string | null) => {
  return getDateTimeInBusinessTimezone(value).toFormat('yyyy-LL');
};

const normalizeBusinessDateFields = <T extends Record<string, any>>(document: T | null | undefined, legacyField = 'date') => {
  if (!document) {
    return document;
  }

  const serviceDate = document.serviceDate || formatServiceDate(document[legacyField]);

  return {
    ...document,
    serviceDate
  };
};

export = {
  BUSINESS_TIMEZONE,
  formatServiceDate,
  getCurrentServiceDate,
  serviceDateToLegacyDate,
  serviceDateToBusinessDayStartUtc,
  serviceDateToBusinessDayEndUtc,
  getMonthServiceDateRange,
  getLegacyRangeFromServiceDates,
  buildServiceDateEqualityQuery,
  buildServiceDateRangeQuery,
  getServiceMonth,
  normalizeBusinessDateFields
};
