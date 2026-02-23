const { ObjectId } = require('mongodb');
const { users } = require('../../config/connectMongodb');

const VALID_ROLES = ['admin', 'manager', 'member', 'moderator', 'staff'];

const createUser = async (req, res) => {
  try {
    const { name, building, room, email, mobile, designation, bank, department } = req.body;

    // Validate required fields
    if (!name || !mobile || !email) {
      return res.status(400).json({
        error: 'name, mobile, email are required'
      });
    }


    // Check if user already exists
    const existingUser = await users.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email already exists'
      });
    }

    // Create user
    const newUser = {
      name,
      building,
      room,
      email,
      mobile,
      bank,
      designation: designation || '',
      department: department || '',
      role: 'member',
      fixedDeposit: 0,
      mosqueFee: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await users.insertOne(newUser);

    return res.status(201).json({
      message: 'User created successfully',
      userId: result.insertedId,
      user: { ...newUser, _id: result.insertedId }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({
      error: 'Failed to create user'
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const email = req.user?.email

    // Find user by Firebase UID
    const user = await users.findOne({ email });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Remove sensitive fields if any
    return res.status(200).json({
      user: user
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({
      error: 'Failed to fetch user profile'
    });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const email = req.user?.email
    const { name, building, room, mobile, designation, department, fixedDeposit } = req.body;

    // Build update object with only provided fields
    const updateData = {
      updatedAt: new Date()
    };

    if (name) updateData.name = name;
    if (building) updateData.building = building;
    if (room) updateData.room = room;
    if (mobile) updateData.mobile = mobile;
    if (designation !== undefined) updateData.designation = designation;
    if (department !== undefined) updateData.department = department;
    if (deposit) updateData.deposit = deposit;

    // Update user
    const result = await users.findOneAndUpdate(
      { email },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: result
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({
      error: 'Failed to update profile'
    });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const currentUserRole = req.user?.role // From auth middleware

    // Check if current user is admin or manager
    if (!['admin', 'manager'].includes(currentUserRole)) {
      return res.status(403).json({
        error: 'Only admins and managers can update user roles'
      });
    }

    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID'
      });
    }

    // Validate role
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `role must be one of: ${VALID_ROLES.join(', ')}`
      });
    }

    // Update user role
    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          role,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    return res.status(200).json({
      message: 'User role updated successfully',
      user: result
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    return res.status(500).json({
      error: 'Failed to update user role'
    });
  }
};

const updateFixedDeposit = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fixedDeposit } = req.body;
    const currentUserRole = req.user?.role // From auth middleware

    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID'
      });
    }

    // Validate role
    if (currentUserRole !== 'admin') {
      return res.status(400).json({
        error: 'You are not authorized'
      });
    }

    // Update user role
    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          fixedDeposit,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    return res.status(200).json({
      message: 'Fixed Deposit Amount updated successfully',
      user: result
    });

  } catch (error) {
    console.error('Error updating fixed deposit amount:', error);
    return res.status(500).json({
      error: 'Failed to update fixed deposit amount'
    });
  }
};

const updateMosqueFee = async (req, res) => {
  try {
    const { userId } = req.params;
    const { mosqueFee } = req.body;
    const currentUserRole = req.user?.role // From auth middleware

    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID'
      });
    }

    // Validate role
    if (currentUserRole !== 'admin') {
      return res.status(400).json({
        error: 'You are not authorized'
      });
    }

    // Update user role
    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          mosqueFee,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    return res.status(200).json({
      message: 'Mosque Fee updated successfully',
      user: result
    });

  } catch (error) {
    console.error('Error updating mosque fee:', error);
    return res.status(500).json({
      error: 'Failed to update mosque fee'
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const currentUserRole = req.user?.role

    // Optional filters from query params
    const { role, department } = req.query;
    const query = {};

    if (role && VALID_ROLES.includes(role)) {
      query.role = role;
    }

    if (department) {
      query.department = department;
    }

    // Fetch all users
    const allUsers = await users.find(query)
      .sort({ room: 1 })
      .toArray();

    return res.status(200).json({
      count: allUsers.length,
      users: allUsers
    });

  } catch (error) {
    console.error('Error fetching all users:', error);
    return res.status(500).json({
      error: 'Failed to fetch users'
    });
  }
};

const getUserRole = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await users.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ role: user.role });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}; 

module.exports = {
  createUser,
  getUserProfile,
  updateUserProfile,
  updateUserRole,
  updateFixedDeposit,
  updateMosqueFee,
  getAllUsers,
  getUserRole
}