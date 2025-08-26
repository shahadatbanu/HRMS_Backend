const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const Employee = require('../models/Employee.js');

dotenv.config();

const createEmployee = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const email = 'emp@gmail.com';
  const password = 'qwER1234!';
  const role = 'employee';

  const existing = await Employee.findOne({ email });
  if (existing) {
    console.log('Employee user already exists.');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new Employee({ email, password: hashedPassword, role });
  await user.save();
  console.log('Employee user created successfully.');
  process.exit(0);
};

createEmployee(); 