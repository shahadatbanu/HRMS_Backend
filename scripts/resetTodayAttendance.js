const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db.js');
const Attendance = require('../models/Attendance.js');
const Employee = require('../models/Employee.js');

(async () => {
  try {
    await connectDB();
    const admin = await Employee.findOne({ role: 'admin' });
    if (!admin) {
      console.log('No admin found');
      process.exit(1);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const result = await Attendance.deleteOne({
      employeeId: admin._id,
      date: { $gte: today, $lt: tomorrow }
    });
    console.log('Deleted:', result);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
