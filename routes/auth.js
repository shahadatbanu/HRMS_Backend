const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee.js');
const auth = require('../middleware/auth.js');

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
        profileImage: employee.profileImage
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
        profileImage: employee.profileImage
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 