const { ObjectId } = require('mongodb');
const { DateTime } = require('luxon');
const { getCollections } = require('../../config/connectMongodb');
const { MEAL_ACTIVITY_ACTIONS } = require('./activityLogs.utils');

const TIME_ZONE = 'Asia/Dhaka';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MANAGER_ROLES = ['admin', 'super_admin'];
const canRequestActivityLogUser = role => MANAGER_ROLES.includes(role);

const parseDateBoundary = (value, endOfDay = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = DateTime.fromFormat(value, 'yyyy-MM-dd', { zone: TIME_ZONE });
  if (!date.isValid) return null;
  return (endOfDay ? date.endOf('day') : date.startOf('day')).toUTC().toJSDate();
};

const parsePositiveInteger = (value, fallback) => {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
};

const buildActivityLogQuery = ({ targetUserId, start, end }) => {
  const query = {
    action: { $in: MEAL_ACTIVITY_ACTIONS }
  };

  if (targetUserId) query.targetUserId = targetUserId;

  if (start || end) {
    query.createdAt = {};
    if (start) query.createdAt.$gte = start;
    if (end) query.createdAt.$lte = end;
  }

  return query;
};

const resolveActivityLogScope = ({ requestedUserId, requester }) => ({
  targetUserId: requestedUserId
    ? new ObjectId(requestedUserId)
    : canRequestActivityLogUser(requester?.role)
      ? null
      : requester?._id,
  isAllUsers: !requestedUserId && canRequestActivityLogUser(requester?.role)
});

const getActivityLogs = async (req, res) => {
  try {
    const { userId: requestedUserId, startDate, endDate } = req.query;
    const page = parsePositiveInteger(req.query.page, 1);
    const requestedLimit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT);
    const limit = requestedLimit && Math.min(requestedLimit, MAX_LIMIT);

    if (!page || !limit) {
      return res.status(400).json({ error: 'page and limit must be positive integers' });
    }

    if (requestedUserId && !canRequestActivityLogUser(req.user?.role)) {
      return res.status(403).json({ error: 'Only admins can view another user\'s activity logs' });
    }

    if (requestedUserId && !ObjectId.isValid(requestedUserId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    const { targetUserId, isAllUsers } = resolveActivityLogScope({
      requestedUserId,
      requester: req.user
    });

    const start = startDate ? parseDateBoundary(startDate) : null;
    const end = endDate ? parseDateBoundary(endDate, true) : null;

    if ((startDate && !start) || (endDate && !end)) {
      return res.status(400).json({ error: 'startDate and endDate must use YYYY-MM-DD format' });
    }

    if (start && end && start > end) {
      return res.status(400).json({ error: 'startDate must be before or equal to endDate' });
    }

    const { users, systemLogs } = await getCollections();
    if (!isAllUsers) {
      const targetUser = await users.findOne({ _id: targetUserId });
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    const query = buildActivityLogQuery({ targetUserId, start, end });

    const [total, logs] = await Promise.all([
      systemLogs.countDocuments(query),
      systemLogs.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray()
    ]);

    return res.status(200).json({
      userId: targetUserId || null,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      startDate: startDate || null,
      endDate: endDate || null,
      logs
    });
  } catch (error) {
    if (error instanceof TypeError || error?.code === 'BSONError') {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    console.error('Error fetching activity logs:', error);
    return res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
};

module.exports = {
  getActivityLogs,
  parseDateBoundary,
  parsePositiveInteger,
  buildActivityLogQuery,
  resolveActivityLogScope,
  canRequestActivityLogUser
};
