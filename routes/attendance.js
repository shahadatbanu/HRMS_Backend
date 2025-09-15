const express = require('express');
const Attendance = require('../models/Attendance.js');
const Employee = require('../models/Employee.js');
const auth = require('../middleware/auth.js');
const role = require('../middleware/role.js');
const ActivityService = require('../services/activityService.js');
const { getCurrentISTTime, getStartOfDayIST, getEndOfDayIST } = require('../utils/timezoneUtils.js');
const { timezoneUtils } = require('../config/timezone.js');

const router = express.Router();

// Get all attendance records (with pagination and filters)
router.get('/', auth, async (req, res) => {
  try {
    // Removed debug log to reduce console noise
    
    const { page = 1, limit = 10, employeeId, startDate, endDate, status, sortBy = 'date', sortOrder = 'desc' } = req.query;
    
    const query = { isActive: true };
    
    // Filter by employee
    if (employeeId) {
      query.employeeId = employeeId;
    }
    
    // Filter by date range
    if (startDate && endDate) {
      // Create start and end of day for proper date comparison
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      query.date = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const skip = (page - 1) * limit;
    
    const attendanceRecords = await Attendance.find(query)
      .populate('employeeId', 'firstName lastName email department designation employeeId profileImage')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Attendance.countDocuments(query);
    
    res.json({
      success: true,
      data: attendanceRecords,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get attendance records for a specific employee
router.get('/employee/:employeeId', auth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate, status } = req.query;
    
    console.log('🔍 GET /attendance/employee/:employeeId - User:', req.user, 'EmployeeId:', employeeId);
    
    const query = { 
      employeeId, 
      isActive: true 
    };
    
    // Filter by date range
    if (startDate && endDate) {
      console.log('📅 Employee date filter - startDate:', startDate, 'endDate:', endDate);
      
      // Create start and end of day for proper date comparison
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log('📅 Employee date filter - startOfDay:', startOfDay, 'endOfDay:', endOfDay);
      
      query.date = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    const attendanceRecords = await Attendance.find(query)
      .populate('employeeId', 'firstName lastName email department designation employeeId profileImage')
      .sort({ date: -1 });

    // Format the attendance records
    const formattedRecords = attendanceRecords.map(record => {
      const formattedDate = record.date.toLocaleDateString('en-US', { 
        timeZone: 'Asia/Kolkata',
        year: 'numeric', 
        month: 'short', 
        day: '2-digit' 
      });
      
      const formattedCheckIn = record.checkIn && record.checkIn.time 
        ? new Date(record.checkIn.time).toLocaleTimeString('en-US', { 
            timeZone: 'Asia/Kolkata',
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          })
        : '';
      
      const formattedCheckOut = record.checkOut && record.checkOut.time 
        ? new Date(record.checkOut.time).toLocaleTimeString('en-US', { 
            timeZone: 'Asia/Kolkata',
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          })
        : '';
      
      const formattedBreakTime = record.totalBreakTime 
        ? `${Math.floor(record.totalBreakTime / 60)}:${(record.totalBreakTime % 60).toString().padStart(2, '0')}`
        : '0:00';
      
      const formattedLateTime = record.lateMinutes > 0 
        ? `${record.lateMinutes} Min`
        : '';
      
      const formattedOvertime = record.overtimeMinutes > 0 
        ? `${Math.floor(record.overtimeMinutes / 60)}:${(record.overtimeMinutes % 60).toString().padStart(2, '0')}`
        : '';
      
      const formattedProductionHours = record.productionHours > 0 
        ? `${record.productionHours.toFixed(2)} Hrs`
        : '0.00';

      return {
        ...record.toObject(),
        formattedDate,
        formattedCheckIn,
        formattedCheckOut,
        formattedBreakTime,
        formattedLateTime,
        formattedOvertime,
        formattedProductionHours
      };
    });
    
    res.json({
      success: true,
      data: formattedRecords
    });
  } catch (error) {
    console.error('Error fetching employee attendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get current day attendance for an employee
router.get('/employee/:employeeId/today', auth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log('🔍 GET /attendance/employee/:employeeId/today - User:', req.user, 'EmployeeId:', employeeId);
    
    const todayAttendance = await Attendance.findOne({
      employeeId,
      date: {
        $gte: today,
        $lt: tomorrow
      },
      isActive: true
    }).populate('employeeId', 'firstName lastName email department designation employeeId profileImage');

    if (!todayAttendance) {
      return res.json({
        success: true,
        data: null
      });
    }

    // Format the attendance record (IST)
    const formattedDate = todayAttendance.date.toLocaleDateString('en-US', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric', 
      month: 'short', 
      day: '2-digit' 
    });
    
    const formattedCheckIn = todayAttendance.checkIn && todayAttendance.checkIn.time 
      ? new Date(todayAttendance.checkIn.time).toLocaleTimeString('en-US', { 
          timeZone: 'Asia/Kolkata',
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })
      : '';
    
    const formattedCheckOut = todayAttendance.checkOut && todayAttendance.checkOut.time 
      ? new Date(todayAttendance.checkOut.time).toLocaleTimeString('en-US', { 
          timeZone: 'Asia/Kolkata',
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })
      : '';
    
    const formattedBreakTime = todayAttendance.totalBreakTime 
      ? `${Math.floor(todayAttendance.totalBreakTime / 60)}:${(todayAttendance.totalBreakTime % 60).toString().padStart(2, '0')}`
      : '0:00';
    
    const formattedLateTime = todayAttendance.lateMinutes > 0 
      ? `${todayAttendance.lateMinutes} Min`
      : '';
    
    const formattedOvertime = todayAttendance.overtimeMinutes > 0 
      ? `${Math.floor(todayAttendance.overtimeMinutes / 60)}:${(todayAttendance.overtimeMinutes % 60).toString().padStart(2, '0')}`
      : '';
    
    const formattedProductionHours = todayAttendance.productionHours > 0 
      ? `${todayAttendance.productionHours.toFixed(2)} Hrs`
      : '0.00';

    const formattedAttendance = {
      ...todayAttendance.toObject(),
      formattedDate,
      formattedCheckIn,
      formattedCheckOut,
      formattedBreakTime,
      formattedLateTime,
      formattedOvertime,
      formattedProductionHours
    };
    
    res.json({
      success: true,
      data: formattedAttendance
    });
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Check-in
router.post('/checkin', auth, async (req, res) => {
  try {
    const { employeeId, location = '', locationName = '', geolocation } = req.body;
    
    console.log('🔍 POST /attendance/checkin - User:', req.user, 'EmployeeId:', employeeId);
    console.log('📍 Location data received:', { location, locationName, geolocation });
    
    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    
    // Check if already checked in today (US Central Time)
    const today = timezoneUtils.getStartOfDay();
    const tomorrow = timezoneUtils.getEndOfDay();
    tomorrow.setMilliseconds(tomorrow.getMilliseconds() + 1);
    
    const existingAttendance = await Attendance.findOne({
      employeeId,
      date: {
        $gte: today,
        $lt: tomorrow
      },
      isActive: true
    });
    
    if (existingAttendance) {
      return res.status(400).json({ success: false, message: 'Already checked in today' });
    }
    
    // Validate geolocation if provided
    let geolocationData = null;
    if (geolocation && geolocation.latitude && geolocation.longitude) {
      // Validate coordinates
      if (geolocation.latitude < -90 || geolocation.latitude > 90) {
        return res.status(400).json({ success: false, message: 'Invalid latitude value' });
      }
      if (geolocation.longitude < -180 || geolocation.longitude > 180) {
        return res.status(400).json({ success: false, message: 'Invalid longitude value' });
      }
      
      geolocationData = {
        latitude: geolocation.latitude,
        longitude: geolocation.longitude
      };
      
      // Optional: Add distance validation from office location
      // You can configure office coordinates in environment variables
      const officeLat = process.env.OFFICE_LATITUDE;
      const officeLng = process.env.OFFICE_LONGITUDE;
      const maxDistance = process.env.MAX_ATTENDANCE_DISTANCE || 1000; // meters
      
      if (officeLat && officeLng) {
        const distance = calculateDistance(
          parseFloat(officeLat),
          parseFloat(officeLng),
          geolocation.latitude,
          geolocation.longitude
        );
        
        // if (distance > maxDistance) {
        //   return res.status(400).json({ 
        //     success: false, 
        //     message: `You are too far from the office. Distance: ${Math.round(distance)}m (max: ${maxDistance}m)` 
        //   });
        // }
      }
    }
    
    // Calculate if late (using IST)
    const checkInTime = timezoneUtils.getCurrentTime();
    const startTime = new Date(today);
    startTime.setHours(9, 0, 0, 0); // 9 AM IST
    
    let status = 'Present';
    let lateMinutes = 0;
    
    if (checkInTime > startTime) {
      status = 'Late';
      lateMinutes = Math.floor((checkInTime - startTime) / (1000 * 60));
    }
    
    console.log(`🕐 Check-in time (IST): ${timezoneUtils.formatDateTime(checkInTime)}`);
    console.log(`🕐 Start time (IST): ${timezoneUtils.formatDateTime(startTime)}`);
    console.log(`📊 Status: ${status}, Late minutes: ${lateMinutes}`);
    
    const attendance = new Attendance({
      employeeId,
      date: today,
      checkIn: {
        time: checkInTime,
        location,
        locationName,
        geolocation: geolocationData
      },
      status,
      lateMinutes
    });
    
    console.log('💾 Saving attendance with location data:', {
      location: attendance.checkIn.location,
      locationName: attendance.checkIn.locationName,
      geolocation: attendance.checkIn.geolocation
    });
    
    await attendance.save();
    
    console.log('✅ Attendance saved successfully. Saved data:', {
      location: attendance.checkIn.location,
      locationName: attendance.checkIn.locationName,
      geolocation: attendance.checkIn.geolocation
    });
    
    // Log activity
    try {
      await ActivityService.logAttendanceMarked(
        req.user.id,
        attendance._id,
        `${employee.firstName} ${employee.lastName}`,
        status
      );
    } catch (activityError) {
      console.error('Error logging attendance activity:', activityError);
    }
    
    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employeeId', 'firstName lastName email department designation employeeId profileImage');
    
    res.status(201).json({
      success: true,
      message: 'Check-in successful',
      data: populatedAttendance
    });
  } catch (error) {
    console.error('Error during check-in:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Check-out
router.post('/checkout', auth, async (req, res) => {
  try {
    const { employeeId, location = '', locationName = '', geolocation } = req.body;
    
    console.log('🔍 POST /attendance/checkout - User:', req.user, 'EmployeeId:', employeeId);
    
    // Find today's attendance record
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const attendance = await Attendance.findOne({
      employeeId,
      date: {
        $gte: today,
        $lt: tomorrow
      },
      isActive: true
    });
    
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'No check-in record found for today' });
    }
    
    if (attendance.checkOut && attendance.checkOut.time) {
      return res.status(400).json({ success: false, message: 'Already checked out today' });
    }
    
    // Validate geolocation if provided
    let geolocationData = null;
    if (geolocation && geolocation.latitude && geolocation.longitude) {
      // Validate coordinates
      if (geolocation.latitude < -90 || geolocation.latitude > 90) {
        return res.status(400).json({ success: false, message: 'Invalid latitude value' });
      }
      if (geolocation.longitude < -180 || geolocation.longitude > 180) {
        return res.status(400).json({ success: false, message: 'Invalid longitude value' });
      }
      
      geolocationData = {
        latitude: geolocation.latitude,
        longitude: geolocation.longitude
      };
    }
    
    const checkOutTime = timezoneUtils.getCurrentTime();
    
    console.log(`🕐 Check-out time (US Central): ${timezoneUtils.formatDateTime(checkOutTime)}`);
    
    // Calculate working hours
    const checkInTime = attendance.checkIn.time;
    const workingHours = (checkOutTime - checkInTime) / (1000 * 60 * 60); // in hours
    
    // Calculate overtime (assuming 8-hour workday)
    const standardWorkHours = 8;
    const overtimeHours = Math.max(0, workingHours - standardWorkHours);
    const overtimeMinutes = Math.floor(overtimeHours * 60);
    
    // Calculate production hours (working hours minus break time)
    const productionHours = workingHours - (attendance.totalBreakTime / 60);
    
    attendance.checkOut = {
      time: checkOutTime,
      location,
      locationName,
      geolocation: geolocationData
    };
    attendance.totalWorkingHours = workingHours;
    attendance.overtimeMinutes = overtimeMinutes;
    attendance.productionHours = Math.max(0, productionHours);
    
    await attendance.save();
    
    // Log activity
    try {
      await ActivityService.logAttendanceMarked(
        req.user.id,
        attendance._id,
        `${attendance.employeeId.firstName} ${attendance.employeeId.lastName}`,
        'checkout'
      );
    } catch (activityError) {
      console.error('Error logging check-out activity:', activityError);
    }
    
    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employeeId', 'firstName lastName email department designation employeeId profileImage');
    
    res.json({
      success: true,
      message: 'Check-out successful',
      data: populatedAttendance
    });
  } catch (error) {
    console.error('Error during check-out:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Start break
router.post('/break/start', auth, async (req, res) => {
  try {
    const { employeeId } = req.body;
    
    console.log('🔍 POST /attendance/break/start - User:', req.user, 'EmployeeId:', employeeId);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const attendance = await Attendance.findOne({
      employeeId,
      date: {
        $gte: today,
        $lt: tomorrow
      },
      isActive: true
    });
    
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'No attendance record found for today' });
    }
    
    // Check if already on break
    const activeBreak = attendance.breaks.find(breakItem => !breakItem.endTime);
    if (activeBreak) {
      return res.status(400).json({ success: false, message: 'Already on break' });
    }
    
    attendance.breaks.push({
      startTime: new Date()
    });
    
    await attendance.save();
    
    res.json({
      success: true,
      message: 'Break started',
      data: attendance
    });
  } catch (error) {
    console.error('Error starting break:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// End break
router.post('/break/end', auth, async (req, res) => {
  try {
    const { employeeId } = req.body;
    
    console.log('🔍 POST /attendance/break/end - User:', req.user, 'EmployeeId:', employeeId);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const attendance = await Attendance.findOne({
      employeeId,
      date: {
        $gte: today,
        $lt: tomorrow
      },
      isActive: true
    });
    
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'No attendance record found for today' });
    }
    
    // Find active break
    const activeBreak = attendance.breaks.find(breakItem => !breakItem.endTime);
    if (!activeBreak) {
      return res.status(400).json({ success: false, message: 'No active break found' });
    }
    
    const endTime = new Date();
    activeBreak.endTime = endTime;
    activeBreak.duration = Math.floor((endTime - activeBreak.startTime) / (1000 * 60)); // in minutes
    
    // Update total break time
    attendance.totalBreakTime = attendance.breaks.reduce((total, breakItem) => {
      return total + (breakItem.duration || 0);
    }, 0);
    
    await attendance.save();
    
    res.json({
      success: true,
      message: 'Break ended',
      data: attendance
    });
  } catch (error) {
    console.error('Error ending break:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get attendance statistics
router.get('/statistics/:employeeId', auth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    let { period = 'month', startDate, endDate } = req.query;
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date();
      end = new Date();
      switch (period) {
        case 'week':
          start.setDate(start.getDate() - 7);
          break;
        case 'month':
          start.setMonth(start.getMonth() - 1);
          break;
        case 'year':
          start.setFullYear(start.getFullYear() - 1);
          break;
        default:
          start.setMonth(start.getMonth() - 1);
      }
    }
    const attendanceRecords = await Attendance.find({
      employeeId,
      date: { $gte: start, $lte: end },
      isActive: true
    });
    // Only include valid records for working hours and production hours
    const validStatuses = ['Present', 'Late', 'Half Day'];
    const validRecords = attendanceRecords.filter(
      record =>
        validStatuses.includes(record.status) &&
        record.checkIn?.time &&
        record.checkOut?.time
    );
    const statistics = {
      totalDays: attendanceRecords.length,
      presentDays: attendanceRecords.filter(record => record.status === 'Present').length,
      absentDays: attendanceRecords.filter(record => record.status === 'Absent').length,
      lateDays: attendanceRecords.filter(record => record.status === 'Late').length,
      totalWorkingHours: validRecords.reduce((sum, record) => sum + (record.totalWorkingHours || 0), 0),
      totalOvertimeHours: validRecords.reduce((sum, record) => sum + (record.overtimeMinutes || 0), 0) / 60,
      averageProductionHours: validRecords.length
        ? validRecords.reduce((sum, record) => sum + (record.productionHours || 0), 0) / validRecords.length
        : 0
    };
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error fetching attendance statistics:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update attendance record (admin only)
router.put('/:id', [auth, role(['admin', 'hr'])], async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('🔍 PUT /attendance/:id - User:', req.user, 'AttendanceId:', id);
    
    const attendance = await Attendance.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('employeeId', 'firstName lastName email department designation employeeId profileImage');
    
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    
    res.json({
      success: true,
      message: 'Attendance record updated successfully',
      data: attendance
    });
  } catch (error) {
    console.error('Error updating attendance record:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Delete attendance record (admin only)
router.delete('/:id', [auth, role(['admin', 'hr'])], async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 DELETE /attendance/:id - User:', req.user, 'AttendanceId:', id);
    
    const attendance = await Attendance.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    
    res.json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting attendance record:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Reset today's attendance (for testing purposes - admin only)
router.delete('/reset/:employeeId', [auth, role(['admin', 'hr'])], async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    console.log('🔍 DELETE /attendance/reset/:employeeId - User:', req.user, 'EmployeeId:', employeeId);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await Attendance.deleteMany({
      employeeId,
      date: {
        $gte: today,
        $lt: tomorrow
      }
    });
    
    res.json({
      success: true,
      message: `Reset attendance for employee ${employeeId}`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error resetting attendance:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router; 