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

const seedAttendanceData = async () => {
  try {
    // Get a sample employee
    const employee = await Employee.findOne();
    if (!employee) {
      console.log('No employee found. Please create an employee first.');
      return;
    }

    console.log(`Seeding attendance data for employee: ${employee.firstName} ${employee.lastName}`);

    // Clear existing attendance data for this employee
    await Attendance.deleteMany({ employeeId: employee._id });

    // Generate sample attendance data for the last 30 days
    const attendanceRecords = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      
      // Generate random check-in time between 8:30 AM and 9:30 AM
      const checkInHour = 8 + Math.floor(Math.random() * 2);
      const checkInMinute = Math.floor(Math.random() * 60);
      const checkInTime = new Date(date);
      checkInTime.setHours(checkInHour, checkInMinute, 0, 0);
      
      // Generate random check-out time between 5:30 PM and 7:00 PM
      const checkOutHour = 17 + Math.floor(Math.random() * 2);
      const checkOutMinute = Math.floor(Math.random() * 60);
      const checkOutTime = new Date(date);
      checkOutTime.setHours(checkOutHour, checkOutMinute, 0, 0);
      
      // Calculate working hours
      const workingHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
      
      // Calculate if late (after 9:00 AM)
      const startTime = new Date(date);
      startTime.setHours(9, 0, 0, 0);
      const lateMinutes = checkInTime > startTime ? Math.floor((checkInTime - startTime) / (1000 * 60)) : 0;
      
      // Calculate overtime (over 8 hours)
      const overtimeHours = Math.max(0, workingHours - 8);
      const overtimeMinutes = Math.floor(overtimeHours * 60);
      
      // Generate random break time (15-45 minutes)
      const breakMinutes = 15 + Math.floor(Math.random() * 31);
      
      // Calculate production hours (working hours minus break time)
      const productionHours = workingHours - (breakMinutes / 60);
      
      // Determine status
      let status = 'Present';
      if (lateMinutes > 30) {
        status = 'Late';
      } else if (Math.random() < 0.1) { // 10% chance of being absent
        status = 'Absent';
        continue; // Skip creating record for absent days
      }
      
      const attendanceRecord = {
        employeeId: employee._id,
        date: date,
        checkIn: {
          time: checkInTime,
          location: 'Office'
        },
        checkOut: {
          time: checkOutTime,
          location: 'Office'
        },
        status,
        breaks: [
          {
            startTime: new Date(checkInTime.getTime() + (4 * 60 * 60 * 1000)), // 4 hours after check-in
            endTime: new Date(checkInTime.getTime() + (4 * 60 * 60 * 1000) + (breakMinutes * 60 * 1000)),
            duration: breakMinutes
          }
        ],
        totalBreakTime: breakMinutes,
        lateMinutes,
        overtimeMinutes,
        productionHours: Math.max(0, productionHours),
        totalWorkingHours: workingHours,
        notes: '',
        isActive: true
      };
      
      attendanceRecords.push(attendanceRecord);
    }
    
    // Insert all attendance records
    await Attendance.insertMany(attendanceRecords);
    
    console.log(`Successfully seeded ${attendanceRecords.length} attendance records`);
    
    // Display some statistics
    const totalRecords = await Attendance.countDocuments({ employeeId: employee._id });
    const presentRecords = await Attendance.countDocuments({ 
      employeeId: employee._id, 
      status: 'Present' 
    });
    const lateRecords = await Attendance.countDocuments({ 
      employeeId: employee._id, 
      status: 'Late' 
    });
    
    console.log(`Total records: ${totalRecords}`);
    console.log(`Present days: ${presentRecords}`);
    console.log(`Late days: ${lateRecords}`);
    
  } catch (error) {
    console.error('Error seeding attendance data:', error);
  }
};

const main = async () => {
  await connectDB();
  await seedAttendanceData();
  mongoose.connection.close();
  console.log('Database connection closed');
};

main(); 