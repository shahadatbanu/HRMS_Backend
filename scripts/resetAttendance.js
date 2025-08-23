const mongoose = require('mongoose');
const Attendance = require('../models/Attendance.js');
const dotenv = require('dotenv');
const { fileURLToPath } = require('url');
const path = require('path');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const resetTodayAttendance = async (employeeId) => {
  try {
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
    
    console.log(`Deleted ${result.deletedCount} attendance record(s) for employee ${employeeId} today`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error resetting attendance:', error);
    throw error;
  }
};

const main = async () => {
  await connectDB();
  
  // Get employee ID from command line arguments
  const employeeId = process.argv[2];
  
  if (!employeeId) {
    console.error('Please provide an employee ID as an argument');
    console.log('Usage: node resetAttendance.js <employeeId>');
    process.exit(1);
  }
  
  try {
    const deletedCount = await resetTodayAttendance(employeeId);
    console.log(`Successfully reset attendance for employee ${employeeId}`);
    console.log(`Deleted ${deletedCount} record(s)`);
  } catch (error) {
    console.error('Failed to reset attendance:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

main(); 