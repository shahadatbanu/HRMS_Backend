const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Employee = require('../models/Employee.js');
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

const getEmployeeId = async () => {
  try {
    const employee = await Employee.findOne();
    if (employee) {
      console.log('Employee ID:', employee._id.toString());
      console.log('Employee Name:', `${employee.firstName} ${employee.lastName}`);
    } else {
      console.log('No employee found');
    }
  } catch (error) {
    console.error('Error getting employee:', error);
  }
};

const main = async () => {
  await connectDB();
  await getEmployeeId();
  mongoose.connection.close();
  console.log('Database connection closed');
};

main(); 