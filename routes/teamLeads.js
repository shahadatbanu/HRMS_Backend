const express = require('express');
const Employee = require('../models/Employee.js');
const auth = require('../middleware/auth.js');

const router = express.Router();

// Protect all routes
router.use(auth);

// GET all team leads (employees with designation containing "Team Lead" or "Team Leader")
router.get('/team-leads', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admin can view team leads.'
      });
    }

    const teamLeads = await Employee.find({
      designation: { $regex: /team lead|team leader/i },
      isDeleted: { $ne: true },
      status: 'Active'
    }).select('firstName lastName email phoneNumber designation department profileImage status joiningDate employeeId');

    // For each team lead, get their recruiters
    const teamLeadsWithRecruiters = await Promise.all(
      teamLeads.map(async (teamLead) => {
        const recruiters = await Employee.find({
          teamLeadId: teamLead._id,
          isDeleted: { $ne: true }
        }).select('firstName lastName email phoneNumber designation department profileImage status joiningDate employeeId');
        
        return {
          ...teamLead.toObject(),
          recruiters
        };
      })
    );

    res.json(teamLeadsWithRecruiters);
  } catch (error) {
    console.error('Error fetching team leads:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// GET recruiters for a specific team lead
router.get('/recruiters/:teamLeadId', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admin can view recruiters.'
      });
    }

    const { teamLeadId } = req.params;

    // Verify team lead exists
    const teamLead = await Employee.findById(teamLeadId);
    if (!teamLead) {
      return res.status(404).json({
        success: false,
        message: 'Team lead not found'
      });
    }

    const recruiters = await Employee.find({
      teamLeadId: teamLeadId,
      isDeleted: { $ne: true }
    }).select('firstName lastName email phoneNumber designation department profileImage status joiningDate employeeId');

    res.json(recruiters);
  } catch (error) {
    console.error('Error fetching recruiters:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// POST create new recruiter
router.post('/recruiters', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admin can create recruiters.'
      });
    }

    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      designation,
      department,
      password,
      employeeId,
      username,
      joiningDate,
      status,
      teamLeadId
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phoneNumber || !password || !employeeId || !username || !teamLeadId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check for existing email/username/employeeId
    if (await Employee.findOne({ email })) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
    if (await Employee.findOne({ username })) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }
    if (await Employee.findOne({ employeeId })) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID already exists'
      });
    }

    // Verify team lead exists
    const teamLead = await Employee.findById(teamLeadId);
    if (!teamLead) {
      return res.status(404).json({
        success: false,
        message: 'Team lead not found'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create recruiter
    const recruiter = new Employee({
      firstName,
      lastName,
      email,
      phoneNumber,
      designation: designation || 'Recruiter',
      department: department || teamLead.department,
      password: hashedPassword,
      employeeId,
      username,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      status: status || 'Active',
      role: 'employee',
      teamLeadId,
      company: teamLead.company,
      isActive: true
    });

    await recruiter.save();

    res.status(201).json({
      success: true,
      data: recruiter,
      message: 'Recruiter created successfully'
    });
  } catch (error) {
    console.error('Error creating recruiter:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// PUT update recruiter
router.put('/recruiters/:recruiterId', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admin can update recruiters.'
      });
    }

    const { recruiterId } = req.params;
    const updateData = req.body;

    // Find recruiter
    const recruiter = await Employee.findById(recruiterId);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: 'Recruiter not found'
      });
    }

    // Check for unique field conflicts (only if values are being changed)
    if (updateData.email && updateData.email !== recruiter.email) {
      const existingEmail = await Employee.findOne({ 
        email: updateData.email, 
        _id: { $ne: recruiterId } 
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    if (updateData.username && updateData.username !== recruiter.username) {
      const existingUsername = await Employee.findOne({ 
        username: updateData.username, 
        _id: { $ne: recruiterId } 
      });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    if (updateData.employeeId && updateData.employeeId !== recruiter.employeeId) {
      const existingEmployeeId = await Employee.findOne({ 
        employeeId: updateData.employeeId, 
        _id: { $ne: recruiterId } 
      });
      if (existingEmployeeId) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID already exists'
        });
      }
    }

    // Update recruiter
    const updatedRecruiter = await Employee.findByIdAndUpdate(
      recruiterId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedRecruiter,
      message: 'Recruiter updated successfully'
    });
  } catch (error) {
    console.error('Error updating recruiter:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// DELETE recruiter
router.delete('/recruiters/:recruiterId', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admin can delete recruiters.'
      });
    }

    const { recruiterId } = req.params;

    // Find recruiter
    const recruiter = await Employee.findById(recruiterId);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: 'Recruiter not found'
      });
    }

    // Soft delete recruiter
    await Employee.findByIdAndUpdate(recruiterId, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Recruiter deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting recruiter:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
