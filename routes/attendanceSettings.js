const express = require('express');
const AttendanceSettings = require('../models/AttendanceSettings.js');
const Attendance = require('../models/Attendance.js');
const Employee = require('../models/Employee.js');
const auth = require('../middleware/auth.js');
const role = require('../middleware/role.js');
const { markAbsencesForToday } = require('../services/attendanceService.js');
const Holiday = require('../models/Holiday.js');
const Leave = require('../models/Leave.js');
const { timezoneUtils } = require('../config/timezone.js');

const router = express.Router();

// Get auto checkout hours setting (public endpoint for frontend)
router.get('/auto-checkout-hours', auth, async (req, res) => {
  try {
    console.log('🔧 GET /attendance-settings/auto-checkout-hours - User:', req.user);
    const settings = await AttendanceSettings.findOne();
    const autoCheckoutHours = settings?.autoCheckoutHours || 16; // Default to 16 hours
    console.log('🔧 Current settings:', settings);
    console.log('🔧 Returning autoCheckoutHours:', autoCheckoutHours);
    
    res.json({
      success: true,
      data: { autoCheckoutHours }
    });
  } catch (error) {
    console.error('❌ Error fetching auto checkout hours:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get attendance settings
router.get('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    // Removed debug log to reduce console noise
    
    let settings = await AttendanceSettings.findOne();
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = new AttendanceSettings({
        createdBy: req.user._id
      });
      await settings.save();
    }
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching attendance settings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update attendance settings
router.put('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    console.log('🔍 PUT /attendance-settings - User:', req.user);
    console.log('🔍 Request body:', req.body);
    
    const {
      autoAbsenceEnabled,
      absenceMarkingTime,
      workingHours,
      lateThresholdMinutes,
      halfDayThresholdHours,
      autoCheckoutHours,
      description
    } = req.body;
    
    let settings = await AttendanceSettings.findOne();
    
    if (!settings) {
      settings = new AttendanceSettings({
        createdBy: req.user._id
      });
    }
    
    // Update fields
    if (autoAbsenceEnabled !== undefined) settings.autoAbsenceEnabled = autoAbsenceEnabled;
    if (absenceMarkingTime) settings.absenceMarkingTime = absenceMarkingTime;
    if (workingHours) {
      if (workingHours.startTime) settings.workingHours.startTime = workingHours.startTime;
      if (workingHours.endTime) settings.workingHours.endTime = workingHours.endTime;
    }
    if (lateThresholdMinutes !== undefined) settings.lateThresholdMinutes = lateThresholdMinutes;
    if (halfDayThresholdHours !== undefined) settings.halfDayThresholdHours = halfDayThresholdHours;
    if (autoCheckoutHours !== undefined) {
      settings.autoCheckoutHours = autoCheckoutHours;
      console.log('🔧 Updated autoCheckoutHours to:', autoCheckoutHours);
    }
    if (description) settings.description = description;
    
    settings.updatedBy = req.user._id;
    
    await settings.save();
    
    // Update cron schedule if settings changed
    const cronService = require('../services/cronService.js');
    await cronService.updateAbsenceMarkingSchedule();
    
    res.json({
      success: true,
      message: 'Attendance settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating attendance settings:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Manual trigger for marking absences
router.post('/mark-absences', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    console.log('🔍 POST /attendance-settings/mark-absences - User:', req.user);
    
    const result = await markAbsencesForToday();
    
    res.json({
      success: true,
      message: 'Absence marking completed',
      data: result
    });
  } catch (error) {
    console.error('Error marking absences:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get absence marking statistics
router.get('/absence-stats', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    // Removed debug log to reduce console noise
    
    const { date } = req.query;
    const targetDate = date ? timezoneUtils.getStartOfDay(new Date(date)) : timezoneUtils.getStartOfDay();
    const nextDay = timezoneUtils.getEndOfDay(targetDate);
    
    // Get all employees
    const totalEmployees = await Employee.countDocuments({ isActive: true });
    
    // Get attendance records for the date
    const attendanceRecords = await Attendance.find({
      date: {
        $gte: targetDate,
        $lt: nextDay
      },
      isActive: true
    }).populate('employeeId', 'firstName lastName email department');
    
    // Count by status
    const stats = {
      totalEmployees,
      onTime: 0,  // Renamed from 'present' to 'onTime'
      absent: 0,
      late: 0,
      halfDay: 0,
      notMarked: 0,
      date: targetDate.toISOString().split('T')[0]
    };
    
    attendanceRecords.forEach(record => {
      switch (record.status) {
        case 'On Time':
        case 'Present':
          stats.onTime++;  // Count both 'On Time' and 'Present' as onTime
          break;
        case 'Absent':
          stats.absent++;
          break;
        case 'Late':
          stats.late++;
          break;
        case 'Half Day':
          stats.halfDay++;
          break;
        default:
          stats.notMarked++;
      }
    });
    
    // Calculate not marked (employees without attendance records)
    stats.notMarked = totalEmployees - (stats.onTime + stats.absent + stats.late + stats.halfDay);
    
    // Calculate total present (on time + late) for dashboard display
    stats.present = stats.onTime + stats.late;
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching absence stats:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get cron service status
router.get('/cron-status', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    console.log('🔍 GET /attendance-settings/cron-status - User:', req.user);
    
    const cronService = require('../services/cronService.js');
    const cronStatus = await cronService.getDetailedStatus();
    
    console.log('📊 Cron Status Response:', JSON.stringify(cronStatus, null, 2));
    
    res.json({
      success: true,
      data: cronStatus
    });
  } catch (error) {
    console.error('Error fetching cron status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Restart cron service
router.post('/cron-restart', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    console.log('🔍 POST /attendance-settings/cron-restart - User:', req.user);
    
    const cronService = require('../services/cronService.js');
    
    // Stop current cron service
    cronService.stop();
    
    // Reinitialize
    await cronService.initialize();
    
    const newStatus = await cronService.getDetailedStatus();
    
    res.json({
      success: true,
      message: 'Cron service restarted successfully',
      data: newStatus
    });
  } catch (error) {
    console.error('Error restarting cron service:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get cron service logs (recent runs)
router.get('/cron-logs', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    console.log('🔍 GET /attendance-settings/cron-logs - User:', req.user);
    
    const { limit = 10 } = req.query;
    
    // Get recent attendance records that were automatically marked as absent
    const recentAbsences = await Attendance.find({
      status: 'Absent',
      notes: { $regex: /Automatically marked absent/ },
      isActive: true
    })
    .populate('employeeId', 'firstName lastName email department')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));
    
    const logs = recentAbsences.map(record => ({
      id: record._id,
      employeeName: `${record.employeeId.firstName} ${record.employeeId.lastName}`,
      date: record.date,
      markedAt: record.createdAt,
      notes: record.notes
    }));
    
    res.json({
      success: true,
      data: {
        logs,
        total: logs.length
      }
    });
  } catch (error) {
    console.error('Error fetching cron logs:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = { router };
