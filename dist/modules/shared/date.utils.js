"use strict";
const luxon_1 = require("luxon");
const BUSINESS_TIMEZONE = 'Asia/Dhaka';
const getDateTimeInBusinessTimezone = (value) => {
    if (!value) {
        return luxon_1.DateTime.now().setZone(BUSINESS_TIMEZONE);
    }
    if (value instanceof Date) {
        return luxon_1.DateTime.fromJSDate(value, { zone: 'utc' }).setZone(BUSINESS_TIMEZONE);
    }
    if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) {
        return luxon_1.DateTime.fromISO(value, { zone: BUSINESS_TIMEZONE });
    }
    return luxon_1.DateTime.fromISO(value, { zone: 'utc' }).setZone(BUSINESS_TIMEZONE);
};
const formatServiceDate = (value) => {
    return getDateTimeInBusinessTimezone(value).toFormat('yyyy-LL-dd');
};
const getCurrentServiceDate = () => {
    return formatServiceDate();
};
const serviceDateToLegacyDate = (serviceDate) => {
    return new Date(`${serviceDate}T00:00:00.000Z`);
};
const serviceDateToBusinessDayStartUtc = (serviceDate) => {
    return luxon_1.DateTime.fromISO(serviceDate, { zone: BUSINESS_TIMEZONE })
        .startOf('day')
        .toUTC()
        .toJSDate();
};
const serviceDateToBusinessDayEndUtc = (serviceDate) => {
    return luxon_1.DateTime.fromISO(serviceDate, { zone: BUSINESS_TIMEZONE })
        .endOf('day')
        .toUTC()
        .toJSDate();
};
const getMonthServiceDateRange = (month) => {
    const start = luxon_1.DateTime.fromISO(`${month}-01`, { zone: BUSINESS_TIMEZONE }).startOf('month');
    const end = start.endOf('month');
    return {
        startServiceDate: start.toFormat('yyyy-LL-dd'),
        endServiceDate: end.toFormat('yyyy-LL-dd')
    };
};
const getLegacyRangeFromServiceDates = (startServiceDate, endServiceDate) => {
    return {
        startDate: serviceDateToLegacyDate(startServiceDate),
        endDate: serviceDateToLegacyDate(endServiceDate)
    };
};
const buildServiceDateEqualityQuery = (legacyField, serviceDate) => {
    return {
        $or: [
            { serviceDate },
            { [legacyField]: serviceDateToLegacyDate(serviceDate) }
        ]
    };
};
const buildServiceDateRangeQuery = (legacyField, startServiceDate, endServiceDate) => {
    const { startDate, endDate } = getLegacyRangeFromServiceDates(startServiceDate, endServiceDate);
    return {
        $or: [
            { serviceDate: { $gte: startServiceDate, $lte: endServiceDate } },
            { [legacyField]: { $gte: startDate, $lte: endDate } }
        ]
    };
};
const getServiceMonth = (value) => {
    return getDateTimeInBusinessTimezone(value).toFormat('yyyy-LL');
};
const normalizeBusinessDateFields = (document, legacyField = 'date') => {
    if (!document) {
        return document;
    }
    const serviceDate = document.serviceDate || formatServiceDate(document[legacyField]);
    return {
        ...document,
        serviceDate
    };
};
module.exports = {
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
