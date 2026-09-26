const { ObjectId } = require('mongodb');

const ACTIVITY_LOG_SCHEMA_VERSION = 1;
const MEAL_ACTIVITY_ACTIONS = ['meal_registered', 'meal_deregistered'];

const asObjectId = value => {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  return new ObjectId(value);
};

const userSnapshot = user => ({
  userId: asObjectId(user?._id),
  name: user?.name || 'Unknown user',
  email: user?.email || ''
});

const userActor = user => ({
  type: 'user',
  userId: asObjectId(user?._id),
  name: user?.name || 'Unknown user',
  email: user?.email || ''
});

const systemActor = (label = 'Automatic registration') => ({
  type: 'system',
  label
});

const getActivitySource = ({ actorUserId, targetUserId, automatic = false }) => {
  if (automatic) return 'auto';
  return asObjectId(actorUserId).equals(asObjectId(targetUserId)) ? 'self' : 'other_user';
};

const buildMealActivityLog = ({
  action,
  registration,
  targetUser,
  actorUser,
  targetUserId,
  trigger,
  automatic = false,
  createdAt = new Date()
}) => {
  if (!MEAL_ACTIVITY_ACTIONS.includes(action)) {
    throw new Error(`Unsupported meal activity action: ${action}`);
  }

  const resolvedTargetUserId = asObjectId(targetUserId || registration?.userId || targetUser?._id);
  const resolvedTarget = targetUser
    ? userSnapshot({ ...targetUser, _id: resolvedTargetUserId })
    : userSnapshot({ _id: resolvedTargetUserId });
  const resolvedActor = actorUser?.type ? actorUser : actorUser ? userActor(actorUser) : actorUser;
  const resolvedActorUserId = resolvedActor?.type === 'user' ? resolvedActor.userId : null;
  const payload = {
    mealDate: registration.date,
    mealType: registration.mealType,
    numberOfMeals: registration.numberOfMeals || 1,
    trigger
  };

  if (registration._id) payload.registrationId = asObjectId(registration._id);
  if (registration.comment !== undefined) payload.comment = registration.comment;

  return {
    schemaVersion: ACTIVITY_LOG_SCHEMA_VERSION,
    action,
    source: getActivitySource({
      actorUserId: resolvedActorUserId || resolvedTargetUserId,
      targetUserId: resolvedTargetUserId,
      automatic
    }),
    targetUserId: resolvedTargetUserId,
    actorUserId: resolvedActorUserId,
    actor: resolvedActor,
    target: resolvedTarget,
    payload,
    createdAt
  };
};

const insertActivityLogs = async (systemLogs, logs, options = {}) => {
  if (!logs || logs.length === 0) return { insertedCount: 0 };
  return systemLogs.insertMany(logs, options.session ? { session: options.session } : undefined);
};

module.exports = {
  ACTIVITY_LOG_SCHEMA_VERSION,
  MEAL_ACTIVITY_ACTIONS,
  asObjectId,
  userSnapshot,
  userActor,
  systemActor,
  getActivitySource,
  buildMealActivityLog,
  insertActivityLogs
};
