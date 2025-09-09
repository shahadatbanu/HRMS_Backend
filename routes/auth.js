const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee.js');
const auth = require('../middleware/auth.js');
const upload = require('../middleware/upload.js');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const employee = await Employee.findOne({ email });
    if (!employee) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign(
      { userId: employee._id, role: employee.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );
    res.json({ 
      token, 
      user: { 
        _id: employee._id,
        email: employee.email, 
        role: employee.role,
        firstName: employee.firstName,
        lastName: employee.lastName,
        profileImage: employee.profileImage,
        phoneNumber: employee.phoneNumber,
        address: employee.address
      } 
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/profile
router.get('/profile', auth, async (req, res) => {
  try {
    // Use the correct user ID field from the JWT token
    const userId = req.user.userId || req.user.id || req.user._id;
    const employee = await Employee.findById(userId).select('-password');
    if (!employee) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ 
      user: {
        _id: employee._id,
        email: employee.email,
        role: employee.role,
        firstName: employee.firstName,
        lastName: employee.lastName,
        profileImage: employee.profileImage,
        phoneNumber: employee.phoneNumber,
        address: employee.address
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', auth, upload.single('profileImage'), async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const employee = await Employee.findById(userId);
    
    if (!employee) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update basic information
    if (req.body.firstName) employee.firstName = req.body.firstName;
    if (req.body.lastName) employee.lastName = req.body.lastName;
    if (req.body.phoneNumber) employee.phoneNumber = req.body.phoneNumber;
    if (req.body.address) employee.address = req.body.address;
    
    // Update profile image if uploaded
    if (req.file) {
      employee.profileImage = req.file.filename;
    }

    await employee.save();

    res.json({ 
      message: 'Profile updated successfully',
      user: {
        _id: employee._id,
        email: employee.email,
        role: employee.role,
        firstName: employee.firstName,
        lastName: employee.lastName,
        profileImage: employee.profileImage,
        phoneNumber: employee.phoneNumber,
        address: employee.address
      }
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 