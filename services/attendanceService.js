const AttendanceSettings = require('../models/AttendanceSettings.js');
const Attendance = require('../models/Attendance.js');
const Employee = require('../models/Employee.js');
const Holiday = require('../models/Holiday.js');
const Leave = require('../models/Leave.js');
const { timezoneUtils } = require('../config/timezone.js');

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
    
    // Use IST for all date calculations
    const now = timezoneUtils.getCurrentTime();
    const today = timezoneUtils.getStartOfDay();
    const tomorrow = timezoneUtils.getEndOfDay();
    tomorrow.setMilliseconds(tomorrow.getMilliseconds() + 1); // Add 1ms to get start of next day
    
    console.log(`🕐 Current IST: ${timezoneUtils.formatDateTime(now)}`);
    console.log(`📅 Today (IST): ${timezoneUtils.formatDate(today)}`);
    
    // Check if today is Sunday (in IST)
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
    
    // Parse absence marking time and create it in IST
    const [absenceHour, absenceMinute] = settings.absenceMarkingTime.split(':').map(Number);
    const absenceTime = new Date(today);
    absenceTime.setHours(absenceHour, absenceMinute, 0, 0);
    
    console.log(`⏰ Absence marking time (IST): ${timezoneUtils.formatDateTime(absenceTime)}`);
    
    // Check if it's past the absence marking time (in IST)
    if (now < absenceTime) {
      console.log('⏰ Not yet time to mark absences');
      return { marked: 0, skipped: 0, reason: 'Before marking time' };
    }
    
    // Get all active employees (excluding admins)
    const employees = await Employee.find({ 
      isActive: true, 
      role: { $ne: 'admin' } 
    });
    
    // Get count of admin users for logging
    const adminCount = await Employee.countDocuments({ 
      isActive: true, 
      role: 'admin' 
    });
    
    console.log(`👥 Found ${employees.length} active employees (excluding ${adminCount} admins)`);
    
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
          notes: `Automatically marked absent - no check-in by ${settings.formattedAbsenceMarkingTime} (US Central Time)`,
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
    console.log(`🕐 Marked at US Central Time: ${timezoneUtils.formatDateTime(now)}`);
    
    return {
      marked: markedCount,
      skipped: skippedCount,
      totalEmployees: employees.length,
      markedTime: now.toISOString(),
      markedTimeCentral: timezoneUtils.formatDateTime(now)
    };
    
  } catch (error) {
    console.error('Error in markAbsencesForToday:', error);
    throw error;
  }
}

module.exports = {
  markAbsencesForToday
};
