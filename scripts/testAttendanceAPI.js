const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Attendance = require('../models/Attendance.js');
const Employee = require('../models/Employee.js');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const testAttendanceAPI = async () => {
  try {
    // Get employee
    const employee = await Employee.findOne();
    if (!employee) {
      console.log('No employee found');
      return;
    }

    console.log(`Testing with employee: ${employee.firstName} ${employee.lastName} (${employee._id})`);

    // Test getting attendance records
    const attendanceRecords = await Attendance.find({ employeeId: employee._id })
      .populate('employeeId', 'firstName lastName email')
      .sort({ date: -1 })
      .limit(5);

    console.log('\n=== Attendance Records ===');
    attendanceRecords.forEach(record => {
      console.log(`Date: ${record.formattedDate}`);
      console.log(`Check In: ${record.formattedCheckIn}`);
      console.log(`Check Out: ${record.formattedCheckOut || 'Not checked out'}`);
      console.log(`Status: ${record.status}`);
      console.log(`Production Hours: ${record.formattedProductionHours}`);
      console.log('---');
    });

    // Test getting today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = await Attendance.findOne({
      employeeId: employee._id,
      date: {
        $gte: today,
        $lt: tomorrow
      }
    }).populate('employeeId', 'firstName lastName email');

    console.log('\n=== Today\'s Attendance ===');
    if (todayAttendance) {
      console.log(`Check In: ${todayAttendance.formattedCheckIn}`);
      console.log(`Check Out: ${todayAttendance.formattedCheckOut || 'Not checked out'}`);
      console.log(`Status: ${todayAttendance.status}`);
      console.log(`Production Hours: ${todayAttendance.formattedProductionHours}`);
    } else {
      console.log('No attendance record for today');
    }

    // Test statistics
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const monthlyRecords = await Attendance.find({
      employeeId: employee._id,
      date: { $gte: startDate, $lte: new Date() }
    });

    const statistics = {
      totalDays: monthlyRecords.length,
      presentDays: monthlyRecords.filter(record => record.status === 'Present').length,
      absentDays: monthlyRecords.filter(record => record.status === 'Absent').length,
      lateDays: monthlyRecords.filter(record => record.status === 'Late').length,
      totalWorkingHours: monthlyRecords.reduce((sum, record) => sum + (record.totalWorkingHours || 0), 0),
      totalOvertimeHours: monthlyRecords.reduce((sum, record) => sum + (record.overtimeMinutes || 0), 0) / 60,
      averageProductionHours: monthlyRecords.reduce((sum, record) => sum + (record.productionHours || 0), 0) / monthlyRecords.length || 0
    };

    console.log('\n=== Monthly Statistics ===');
    console.log(`Total Days: ${statistics.totalDays}`);
    console.log(`Present Days: ${statistics.presentDays}`);
    console.log(`Late Days: ${statistics.lateDays}`);
    console.log(`Total Working Hours: ${statistics.totalWorkingHours.toFixed(2)}`);
    console.log(`Total Overtime Hours: ${statistics.totalOvertimeHours.toFixed(2)}`);
    console.log(`Average Production Hours: ${statistics.averageProductionHours.toFixed(2)}`);

  } catch (error) {
    console.error('Error testing attendance API:', error);
  }
};

const main = async () => {
  await connectDB();
  await testAttendanceAPI();
  mongoose.connection.close();
  console.log('\nDatabase connection closed');
};

main(); 