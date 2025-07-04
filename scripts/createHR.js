import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const createHR = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const email = 'hr@gmail.com';
  const password = 'qwER1234!';
  const role = 'hr';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log('HR user already exists.');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hashedPassword, role });
  await user.save();
  console.log('HR user created successfully.');
  process.exit(0);
};

createHR(); 