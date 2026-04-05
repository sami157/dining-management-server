const { ObjectId } = require('mongodb');
const { getCollections } = require('../../config/connectMongodb');
const admin = require('../../config/firebaseAdmin');

const VALID_ROLES = ['admin', 'manager', 'member', 'moderator', 'staff', 'super_admin'];

const createUser = async (req, res) => {
  try {
    const { name, building, room, email, mobile, designation, bank, department } = req.body;
    const firebaseUid = req.firebaseUser?.uid;
    const tokenEmail = req.firebaseUser?.email;

    if (!firebaseUid || !tokenEmail) {
      return res.status(401).json({ error: 'Authenticated Firebase user is required' });
    }

    if (email && email !== tokenEmail) {
      return res.status(400).json({ error: 'Email must match the authenticated Firebase user' });
    }

    if (!name || !mobile) {
      return res.status(400).json({ error: 'name and mobile are required' });
    }

    const firebaseUser = await admin.auth().getUser(firebaseUid);

    const { users } = await getCollections();
    const existingUser = await users.findOne({
      $or: [
        { email: tokenEmail },
        { firebaseUid }
      ]
    });

    const now = new Date();
    const syncData = {
      firebaseUid,
      email: firebaseUser.email || tokenEmail,
      emailVerified: Boolean(firebaseUser.emailVerified),
      displayName: firebaseUser.displayName || '',
      phoneNumber: firebaseUser.phoneNumber || '',
      photoURL: firebaseUser.photoURL || '',
      providers: (firebaseUser.providerData || []).map(provider => provider.providerId),
      lastSyncedAt: now,
      updatedAt: now
    };

    if (existingUser) {
      const updateData = {
        ...syncData,
        name,
        building,
        room,
        mobile,
        bank,
        designation: designation || '',
        department: department || ''
      };

      await users.updateOne(
        { _id: existingUser._id },
        { $set: updateData }
      );

      const syncedUser = await users.findOne({ _id: existingUser._id });

      return res.status(200).json({
        message: 'User synced successfully',
        userId: existingUser._id,
        user: syncedUser
      });
    }

    const newUser = {
      firebaseUid,
      email: firebaseUser.email || tokenEmail,
      emailVerified: Boolean(firebaseUser.emailVerified),
      displayName: firebaseUser.displayName || '',
      phoneNumber: firebaseUser.phoneNumber || '',
      photoURL: firebaseUser.photoURL || '',
      providers: (firebaseUser.providerData || []).map(provider => provider.providerId),
      name, building, room, mobile, bank,
      designation: designation || '',
      department: department || '',
      role: 'member',
      fixedDeposit: 0,
      mosqueFee: 0,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now
    };

    const result = await users.insertOne(newUser);

    return res.status(201).json({
      message: 'User registered and synced successfully',
      userId: result.insertedId,
      user: { ...newUser, _id: result.insertedId }
    });

  } catch (error) {
    console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Failed to register user' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const email = req.user?.email;

    const { users } = await getCollections();
    const user = await users.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const email = req.user?.email;
    const { name, building, room, mobile, designation, department } = req.body;

    const updateData = { updatedAt: new Date() };

    if (name) updateData.name = name;
    if (building) updateData.building = building;
    if (room) updateData.room = room;
    if (mobile) updateData.mobile = mobile;
    if (designation !== undefined) updateData.designation = designation;
    if (department !== undefined) updateData.department = department;

    const { users } = await getCollections();
    const result = await users.findOneAndUpdate(
      { email },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'Profile updated successfully', user: result });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const currentUserRole = req.user?.role;

    if (!['admin', 'manager'].includes(currentUserRole)) {
      return res.status(403).json({ error: 'Only admins and managers can update user roles' });
    }

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const { users } = await getCollections();
    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { role, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'User role updated successfully', user: result });

  } catch (error) {
    console.error('Error updating user role:', error);
    return res.status(500).json({ error: 'Failed to update user role' });
  }
};

const updateFixedDeposit = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fixedDeposit } = req.body;
    const currentUserRole = req.user?.role;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (currentUserRole !== 'admin' && currentUserRole !== 'super_admin') {
      return res.status(403).json({ error: 'You are not authorized' });
    }

    const { users } = await getCollections();
    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { fixedDeposit, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'Fixed Deposit Amount updated successfully', user: result });

  } catch (error) {
    console.error('Error updating fixed deposit amount:', error);
    return res.status(500).json({ error: 'Failed to update fixed deposit amount' });
  }
};

const updateMosqueFee = async (req, res) => {
  try {
    const { userId } = req.params;
    const { mosqueFee } = req.body;
    const currentUserRole = req.user?.role;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (currentUserRole !== 'admin' && currentUserRole !== 'super_admin') {
      return res.status(403).json({ error: 'You are not authorized' });
    }

    const { users } = await getCollections();
    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { mosqueFee, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'Mosque Fee updated successfully', user: result });

  } catch (error) {
    console.error('Error updating mosque fee:', error);
    return res.status(500).json({ error: 'Failed to update mosque fee' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { role, department } = req.query;
    const query = {};

    if (role && VALID_ROLES.includes(role)) query.role = role;
    if (department) query.department = department;

    const { users } = await getCollections();
    const allUsers = await users.find(query).sort({ room: 1 }).toArray();
    let totalFixedDeposit = 0
    allUsers.forEach(user => {
      totalFixedDeposit += user.fixedDeposit
    });

    return res.status(200).json({ count: allUsers.length, users: allUsers, totalFixedDeposit });

  } catch (error) {
    console.error('Error fetching all users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
};

const getUserRole = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const { users } = await getCollections();
    const user = await users.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ role: user.role });

  } catch (error) {
    console.error('Error fetching user role:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const checkUserWithEmail = async (req, res) => {
  const { email } = req.params
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const { users } = await getCollections();
  const user = await users.findOne({ email });
  if (!user) {
    return res.status(200).json({ doesExist: false });
  }
  return res.status(200).json({ doesExist: true });
}

module.exports = {
  createUser,
  getUserProfile,
  updateUserProfile,
  updateUserRole,
  updateFixedDeposit,
  updateMosqueFee,
  getAllUsers,
  getUserRole,
  checkUserWithEmail
};
