import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const createEmployee = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const email = 'emp@gmail.com';
  const password = 'qwER1234!';
  const role = 'employee';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log('Employee user already exists.');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hashedPassword, role });
  await user.save();
  console.log('Employee user created successfully.');
  process.exit(0);
};

createEmployee(); 