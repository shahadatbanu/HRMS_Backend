const express = require('express');
const router = express.Router();
const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const ActivityService = require('../services/activityService.js');
// const auth = require('../middleware/auth'); // Uncomment if you want to protect routes

// Function to create attendance records for approved leave
async function createAttendanceRecordsForLeave(leave) {
  try {
    const startDate = new Date(leave.from);
    const endDate = new Date(leave.to);
    
    // Generate attendance records for each day of the leave
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (date.getDay() === 0 || date.getDay() === 6) {
        continue;
      }
      
      // Check if attendance record already exists for this date
      const existingAttendance = await Attendance.findOne({
        employeeId: leave.employeeId,
        date: {
          $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
        },
        isActive: true
      });
      
      if (existingAttendance) {
        // Update existing attendance record to "On Leave"
        existingAttendance.status = 'On Leave';
        existingAttendance.notes = `On approved leave: ${leave.leaveType} - ${leave.reason || 'No reason provided'}`;
        await existingAttendance.save();
        console.log(`Updated attendance record for ${date.toDateString()} to "On Leave"`);
      } else {
        // Create new attendance record with "On Leave" status
        const attendanceRecord = new Attendance({
          employeeId: leave.employeeId,
          date: date,
          status: 'On Leave',
          notes: `On approved leave: ${leave.leaveType} - ${leave.reason || 'No reason provided'}`,
          isActive: true
        });
        
        await attendanceRecord.save();
        console.log(`Created attendance record for ${date.toDateString()} with "On Leave" status`);
      }
    }
  } catch (error) {
    console.error('Error creating attendance records for leave:', error);
    throw error;
  }
}

// Function to update attendance records when leave is cancelled/declined
async function updateAttendanceRecordsForCancelledLeave(leave) {
  try {
    const startDate = new Date(leave.from);
    const endDate = new Date(leave.to);
    
    // Update attendance records for each day of the leave
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) {
        continue;
      }
      
      // Find attendance record for this date
      const existingAttendance = await Attendance.findOne({
        employeeId: leave.employeeId,
        date: {
          $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
        },
        isActive: true
      });
      
      if (existingAttendance && existingAttendance.status === 'On Leave') {
        // If the attendance was created for this leave, remove it
        if (existingAttendance.notes && existingAttendance.notes.includes(`On approved leave: ${leave.leaveType}`)) {
          await Attendance.findByIdAndDelete(existingAttendance._id);
          console.log(`Removed attendance record for ${date.toDateString()} (cancelled leave)`);
        }
      }
    }
  } catch (error) {
    console.error('Error updating attendance records for cancelled leave:', error);
    throw error;
  }
}

// Get all leave requests (admin/HR)
router.get('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    // Query params for filtering, sorting, and pagination
    const {
      status,
      employeeId,
      leaveType,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = { isDeleted: false };
    if (status) query.status = status;
    if (employeeId) query.employeeId = employeeId;
    if (leaveType) query.leaveType = leaveType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [leaves, total] = await Promise.all([
      Leave.find(query)
        .populate('employeeId', 'firstName lastName profileImage department designation')
        .populate('approvedBy', 'firstName lastName profileImage')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Leave.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: leaves,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all leave requests for an employee
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const leaves = await Leave.find({ employeeId: req.params.employeeId, isDeleted: false })
      .populate('employeeId', 'firstName lastName profileImage department designation')
      .populate('approvedBy', 'firstName lastName profileImage');
    res.json({ success: true, data: leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get leave balances for an employee (simple count by type)
router.get('/balance/:employeeId', async (req, res) => {
  try {
    const leaves = await Leave.find({ employeeId: req.params.employeeId, status: { $ne: 'Declined' }, isDeleted: false });
    const balance = {};
    leaves.forEach(l => {
      balance[l.leaveType] = (balance[l.leaveType] || 0) + l.noOfDays;
    });
    res.json({ success: true, data: balance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add a new leave request
router.post('/', async (req, res) => {
  try {
    const leave = new Leave(req.body);
    await leave.save();
    
    // Log activity
    try {
      const employee = await Employee.findById(leave.employeeId);
      if (employee) {
        await ActivityService.logLeaveRequested(
          req.user?.id || leave.createdBy,
          leave._id,
          `${employee.firstName} ${employee.lastName}`
        );
      }
    } catch (activityError) {
      console.error('Error logging leave request activity:', activityError);
    }
    
    res.status(201).json({ success: true, data: leave });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Update a leave request (approve/decline/cancel/edit)
router.put('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const leave = await Leave.findById(req.params.id);
    
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    // If approving a leave request, check quota and auto-reject others if needed
    if (status === 'Approved') {
      const employeeId = leave.employeeId;
      const totalQuota = 12; // Fixed quota for all employees
      
      // Get all approved leaves for this employee
      const approvedLeaves = await Leave.find({
        employeeId,
        status: 'Approved',
        isDeleted: false
      });
      
      const totalApprovedDays = approvedLeaves.reduce((sum, l) => sum + (l.noOfDays || 0), 0);
      const newTotalAfterApproval = totalApprovedDays + (leave.noOfDays || 0);
      
      // If this approval would exceed quota, reject it
      if (newTotalAfterApproval > totalQuota) {
        return res.status(400).json({ 
          success: false, 
          message: `Approving this leave would exceed the ${totalQuota}-day quota. Current approved: ${totalApprovedDays}, Requested: ${leave.noOfDays}` 
        });
      }
      
      // If this approval reaches the quota limit, auto-reject all other unapproved leaves
      if (newTotalAfterApproval === totalQuota) {
        const unapprovedLeaves = await Leave.find({
          employeeId,
          status: 'New',
          isDeleted: false,
          _id: { $ne: leave._id } // Exclude the current leave being approved
        });
        
        // Auto-reject all other unapproved leaves
        if (unapprovedLeaves.length > 0) {
          await Leave.updateMany(
            {
              employeeId,
              status: 'New',
              isDeleted: false,
              _id: { $ne: leave._id }
            },
            {
              status: 'Declined',
              approvedBy: req.body.approvedBy || req.user?._id,
              approvedAt: new Date()
            }
          );
        }
      }
      
      // Create attendance records for the approved leave
      try {
        await createAttendanceRecordsForLeave(leave);
        console.log(`✅ Created attendance records for approved leave: ${leave._id}`);
      } catch (error) {
        console.error('❌ Error creating attendance records for approved leave:', error);
        // Don't fail the leave approval if attendance creation fails
      }
    }
    
    // If cancelling or declining a leave request, update attendance records
    if (status === 'Cancelled' || status === 'Declined') {
      try {
        await updateAttendanceRecordsForCancelledLeave(leave);
        console.log(`✅ Updated attendance records for ${status.toLowerCase()} leave: ${leave._id}`);
      } catch (error) {
        console.error(`❌ Error updating attendance records for ${status.toLowerCase()} leave:`, error);
        // Don't fail the leave update if attendance update fails
      }
    }

    // Update the leave request
    const updatedLeave = await Leave.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, updatedAt: new Date() }, 
      { new: true }
    ).populate('employeeId', 'firstName lastName profileImage department designation')
     .populate('approvedBy', 'firstName lastName profileImage');

    // Log activity for approval/rejection
    try {
      if (status === 'Approved') {
        await ActivityService.logLeaveApproved(
          req.user?.id || req.body.approvedBy,
          updatedLeave._id,
          `${updatedLeave.employeeId.firstName} ${updatedLeave.employeeId.lastName}`
        );
      } else if (status === 'Declined') {
        await ActivityService.logLeaveRejected(
          req.user?.id || req.body.approvedBy,
          updatedLeave._id,
          `${updatedLeave.employeeId.firstName} ${updatedLeave.employeeId.lastName}`
        );
      }
    } catch (activityError) {
      console.error('Error logging leave status change activity:', activityError);
    }

    res.json({ success: true, data: updatedLeave });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Delete (soft delete) a leave request
router.delete('/:id', async (req, res) => {
  try {
    const leave = await Leave.findByIdAndUpdate(req.params.id, { isDeleted: true, deletedAt: new Date() }, { new: true });
    res.json({ success: true, data: leave });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
