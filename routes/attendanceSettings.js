const express = require('express');
const AttendanceSettings = require('../models/AttendanceSettings.js');
const Attendance = require('../models/Attendance.js');
const Employee = require('../models/Employee.js');
const auth = require('../middleware/auth.js');
const role = require('../middleware/role.js');
const cronService = require('../services/cronService.js');
const Holiday = require('../models/Holiday.js');
const Leave = require('../models/Leave.js');

const router = express.Router();

// Get attendance settings
router.get('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    console.log('🔍 GET /attendance-settings - User:', req.user);
    
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
    
    const {
      autoAbsenceEnabled,
      absenceMarkingTime,
      workingHours,
      lateThresholdMinutes,
      halfDayThresholdHours,
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
    if (description) settings.description = description;
    
    settings.updatedBy = req.user._id;
    
    await settings.save();
    
    // Update cron schedule if settings changed
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
    console.log('🔍 GET /attendance-settings/absence-stats - User:', req.user);
    
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
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
        case 'Present':
          stats.onTime++;  // Count as 'onTime' (on time)
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

// Function to mark absences for today
async function markAbsencesForToday() {
  try {
    console.log('🔄 Starting automatic absence marking...');
    
    // Get attendance settings
    const settings = await AttendanceSettings.findOne();
    if (!settings || !settings.autoAbsenceEnabled) {
      console.log('❌ Automatic absence marking is disabled');
      return { marked: 0, skipped: 0, reason: 'Feature disabled' };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if today is Sunday
    if (today.getDay() === 0) {
      console.log('⏸️ Today is Sunday. Skipping absence marking.');
      return { marked: 0, skipped: 0, reason: 'Sunday' };
    }

    // Check if today is a holiday
    const holiday = await Holiday.findOne({ date: { $gte: today, $lt: tomorrow } });
    if (holiday) {
      console.log('⏸️ Today is a holiday. Skipping absence marking.');
      return { marked: 0, skipped: 0, reason: 'Holiday' };
    }
    
    // Parse absence marking time
    const [absenceHour, absenceMinute] = settings.absenceMarkingTime.split(':').map(Number);
    const absenceTime = new Date(today);
    absenceTime.setHours(absenceHour, absenceMinute, 0, 0);
    
    // Check if it's past the absence marking time
    const now = new Date();
    if (now < absenceTime) {
      console.log('⏰ Not yet time to mark absences');
      return { marked: 0, skipped: 0, reason: 'Before marking time' };
    }
    
    // Get all active employees
    const employees = await Employee.find({ isActive: true });
    console.log(`👥 Found ${employees.length} active employees`);
    
    let markedCount = 0;
    let skippedCount = 0;
    
    for (const employee of employees) {
      try {
        // Check if employee already has attendance record for today
        const existingAttendance = await Attendance.findOne({
          employeeId: employee._id,
          date: {
            $gte: today,
            $lt: tomorrow
          },
          isActive: true
        });
        
        if (existingAttendance) {
          console.log(`✅ Employee ${employee.firstName} ${employee.lastName} already has attendance record`);
          skippedCount++;
          continue;
        }
        
        // Check if employee has approved leave for today
        const approvedLeave = await Leave.findOne({
          employeeId: employee._id,
          status: 'Approved',
          from: { $lte: today },
          to: { $gte: today },
          isDeleted: { $ne: true }
        });
        if (approvedLeave) {
          console.log(`⏸️ Employee ${employee.firstName} ${employee.lastName} is on approved leave. Skipping absence marking.`);
          skippedCount++;
          continue;
        }
        
        // Create absence record
        const absenceRecord = new Attendance({
          employeeId: employee._id,
          date: today,
          status: 'Absent',
          notes: `Automatically marked absent - no check-in by ${settings.formattedAbsenceMarkingTime}`,
          isActive: true
        });
        
        await absenceRecord.save();
        console.log(`❌ Marked ${employee.firstName} ${employee.lastName} as absent`);
        markedCount++;
        
      } catch (error) {
        console.error(`Error processing employee ${employee.firstName} ${employee.lastName}:`, error);
        skippedCount++;
      }
    }
    
    console.log(`✅ Absence marking completed: ${markedCount} marked, ${skippedCount} skipped`);
    
    return {
      marked: markedCount,
      skipped: skippedCount,
      totalEmployees: employees.length,
      markedTime: now.toISOString()
    };
    
  } catch (error) {
    console.error('Error in markAbsencesForToday:', error);
    throw error;
  }
}

module.exports = router;
