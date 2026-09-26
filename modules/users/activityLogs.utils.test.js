const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const {
  buildMealActivityLog,
  systemActor
} = require('./activityLogs.utils');
const {
  parseDateBoundary,
  parsePositiveInteger,
  buildActivityLogQuery,
  resolveActivityLogScope,
  canRequestActivityLogUser
} = require('./activityLogs.controller');

const target = {
  _id: new ObjectId('000000000000000000000001'),
  name: 'Target User',
  email: 'target@example.com'
};

const actor = {
  _id: new ObjectId('000000000000000000000002'),
  name: 'Actor User',
  email: 'actor@example.com'
};

const registration = {
  _id: new ObjectId('000000000000000000000003'),
  userId: target._id,
  date: new Date('2026-09-25T00:00:00.000Z'),
  mealType: 'night',
  numberOfMeals: 2,
  comment: 'Dinner'
};

test('classifies self and other-user meal activity correctly', () => {
  const selfLog = buildMealActivityLog({
    action: 'meal_registered',
    registration,
    targetUser: target,
    actorUser: target,
    trigger: 'direct'
  });
  const otherLog = buildMealActivityLog({
    action: 'meal_deregistered',
    registration,
    targetUser: target,
    actorUser: actor,
    trigger: 'explicit_cancel'
  });

  assert.equal(selfLog.source, 'self');
  assert.equal(selfLog.actor.type, 'user');
  assert.equal(otherLog.source, 'other_user');
  assert.equal(otherLog.actor.userId.toString(), actor._id.toString());
});

test('automatic activity has a system actor and keeps an extensible payload', () => {
  const log = buildMealActivityLog({
    action: 'meal_registered',
    registration,
    targetUser: target,
    actorUser: systemActor('Automatic registration'),
    trigger: 'schedule_generation',
    automatic: true
  });

  assert.equal(log.schemaVersion, 1);
  assert.equal(log.source, 'auto');
  assert.equal(log.actor.type, 'system');
  assert.equal(log.actor.label, 'Automatic registration');
  assert.equal(log.payload.registrationId.toString(), registration._id.toString());
  assert.equal(log.payload.mealDate.toISOString(), registration.date.toISOString());
  assert.equal(log.payload.numberOfMeals, 2);
  assert.equal(log.payload.comment, 'Dinner');
});

test('activity log date parsing uses inclusive Asia/Dhaka day boundaries', () => {
  assert.equal(
    parseDateBoundary('2026-09-25').toISOString(),
    '2026-09-24T18:00:00.000Z'
  );
  assert.equal(
    parseDateBoundary('2026-09-25', true).toISOString(),
    '2026-09-25T17:59:59.999Z'
  );
  assert.equal(parseDateBoundary('25-09-2026'), null);
});

test('activity log query pagination and filters are validated and composed', () => {
  assert.equal(parsePositiveInteger(undefined, 25), 25);
  assert.equal(parsePositiveInteger('100'), 100);
  assert.equal(parsePositiveInteger('0'), null);
  assert.equal(parsePositiveInteger('abc'), null);

  const targetUserId = target._id;
  const start = parseDateBoundary('2026-09-01');
  const end = parseDateBoundary('2026-09-30', true);
  assert.deepEqual(buildActivityLogQuery({ targetUserId, start, end }), {
    targetUserId,
    action: { $in: ['meal_registered', 'meal_deregistered'] },
    createdAt: { $gte: start, $lte: end }
  });

  assert.deepEqual(buildActivityLogQuery({ start, end }), {
    action: { $in: ['meal_registered', 'meal_deregistered'] },
    createdAt: { $gte: start, $lte: end }
  });
});

test('activity log scope supports manager-wide logs and preserves user isolation', () => {
  const regularUserId = new ObjectId('000000000000000000000004');
  const selectedUserId = target._id.toString();

  assert.deepEqual(
    resolveActivityLogScope({ requester: { _id: regularUserId, role: 'member' } }),
    { targetUserId: regularUserId, isAllUsers: false }
  );
  assert.deepEqual(
    resolveActivityLogScope({ requester: { _id: regularUserId, role: 'admin' } }),
    { targetUserId: null, isAllUsers: true }
  );
  assert.deepEqual(
    resolveActivityLogScope({ requester: { _id: regularUserId, role: 'super_admin' } }),
    { targetUserId: null, isAllUsers: true }
  );

  const selectedScope = resolveActivityLogScope({
    requestedUserId: selectedUserId,
    requester: { _id: regularUserId, role: 'admin' }
  });
  assert.equal(selectedScope.targetUserId.toString(), selectedUserId);
  assert.equal(selectedScope.isAllUsers, false);
});

test('only admins can request a specific activity-log user', () => {
  assert.equal(canRequestActivityLogUser('member'), false);
  assert.equal(canRequestActivityLogUser('admin'), true);
  assert.equal(canRequestActivityLogUser('super_admin'), true);
});
