const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const admin = require('../../config/firebaseAdmin');
const { getCollections } = require('../../config/connectMongodb');

const RECOVERY_TTL_MS = 10 * 60 * 1000;
const RECOVERY_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const GENERIC_RECOVERY_FAILURE = 'Invalid or expired recovery code';

let indexesReady;

const ensureRecoveryIndexes = async (passwordRecoveryCodes) => {
  if (!indexesReady) {
    indexesReady = Promise.all([
      passwordRecoveryCodes.createIndex({ userId: 1, used: 1, expiresAt: 1 }),
      passwordRecoveryCodes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch((error) => {
      indexesReady = null;
      throw error;
    });
  }

  return indexesReady;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizeRecoveryCode = (code) => String(code || '').trim().toUpperCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findUserByEmail = (users, email) => users.findOne({
  email: new RegExp(`^${escapeRegex(email)}$`, 'i'),
  isActive: { $ne: false },
});

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidNewPassword = (password) => typeof password === 'string' && password.length >= 6 && password.length <= 128;

const generateRecoveryCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
};

const hashRecoveryCode = (code, salt = crypto.randomBytes(16).toString('hex')) => {
  const codeHash = crypto
    .createHash('sha256')
    .update(`${salt}:${normalizeRecoveryCode(code)}`)
    .digest('hex');

  return { codeHash, codeSalt: salt };
};

const hashesMatch = (plainCode, record) => {
  const expected = Buffer.from(record.codeHash, 'hex');
  const actual = Buffer.from(hashRecoveryCode(plainCode, record.codeSalt).codeHash, 'hex');

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const createRecoveryCode = async (req, res) => {
  try {
    const { userId } = req.body || {};

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const { users, passwordRecoveryCodes, systemLogs } = await getCollections();
    await ensureRecoveryIndexes(passwordRecoveryCodes);

    const targetUser = await users.findOne({ _id: new ObjectId(userId), isActive: { $ne: false } });
    if (!targetUser?.email) {
      return res.status(404).json({ message: 'User not found' });
    }

    try {
      await admin.auth().getUserByEmail(targetUser.email);
    } catch (error) {
      return res.status(404).json({ message: 'Firebase account not found' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + RECOVERY_TTL_MS);
    const recoveryCode = generateRecoveryCode();
    const { codeHash, codeSalt } = hashRecoveryCode(recoveryCode);

    await passwordRecoveryCodes.updateMany(
      { userId: targetUser._id, used: false },
      { $set: { used: true, invalidatedAt: now, invalidatedReason: 'replaced' } }
    );

    await passwordRecoveryCodes.insertOne({
      userId: targetUser._id,
      email: normalizeEmail(targetUser.email),
      codeHash,
      codeSalt,
      used: false,
      createdAt: now,
      expiresAt,
      createdByAdminId: req.user._id,
      createdByAdminEmail: req.user.email,
    });

    await systemLogs.insertOne({
      type: 'password-recovery-code-created',
      adminUserId: req.user._id,
      adminEmail: req.user.email,
      targetUserId: targetUser._id,
      targetEmail: normalizeEmail(targetUser.email),
      createdAt: now,
      expiresAt,
    });

    return res.status(201).json({
      recoveryCode,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating recovery code:', error);
    return res.status(500).json({ message: 'Failed to create recovery code' });
  }
};

const recoverPassword = async (req, res) => {
  const fail = () => res.status(400).json({ message: GENERIC_RECOVERY_FAILURE });

  try {
    const email = normalizeEmail(req.body?.email);
    const recoveryCode = normalizeRecoveryCode(req.body?.recoveryCode);
    const { newPassword } = req.body || {};

    if (!isValidEmail(email) || !RECOVERY_CODE_PATTERN.test(recoveryCode) || !isValidNewPassword(newPassword)) {
      return fail();
    }

    const now = new Date();
    const { users, passwordRecoveryCodes } = await getCollections();
    await ensureRecoveryIndexes(passwordRecoveryCodes);

    const user = await findUserByEmail(users, email);
    if (!user) {
      return fail();
    }

    const activeRecords = await passwordRecoveryCodes
      .find({ userId: user._id, email: normalizeEmail(user.email), used: false, expiresAt: { $gt: now } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const matchingRecord = activeRecords.find((record) => hashesMatch(recoveryCode, record));
    if (!matchingRecord) {
      return fail();
    }

    const consumed = await passwordRecoveryCodes.findOneAndUpdate(
      { _id: matchingRecord._id, used: false, expiresAt: { $gt: now } },
      { $set: { used: true, usedAt: now } },
      { returnDocument: 'after' }
    );

    if (!consumed) {
      return fail();
    }

    const firebaseUser = await admin.auth().getUserByEmail(user.email);
    await admin.auth().updateUser(firebaseUser.uid, { password: newPassword });

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Error recovering password:', error);
    return fail();
  }
};

module.exports = {
  createRecoveryCode,
  recoverPassword,
};
