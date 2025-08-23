const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const Employee = require('../models/Employee.js');

dotenv.config();

const createAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const email = 'syogesh565@gmail.com';
  const password = 'qwER1234!';
  const role = 'admin';

  const existing = await Employee.findOne({ email });
  if (existing) {
    console.log('Admin user already exists.');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new Employee({ 
    email, 
    password: hashedPassword, 
    role,
    firstName: 'Admin',
    lastName: 'User',
    employeeId: 'EMP001',
    joiningDate: new Date(),
    username: 'admin',
    phoneNumber: '1234567890',
    company: 'HRMS',
    department: 'IT',
    designation: 'System Administrator'
  });
  await user.save();
  console.log('Admin user created successfully.');
  process.exit(0);
};

createAdmin(); 