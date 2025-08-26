const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function fixTerminatedField() {
  try {
    await mongoose.connect(MONGO_URI);
    const result = await Employee.updateMany({}, { $set: { terminated: false } });
    console.log('Updated employees:', result.modifiedCount);
    process.exit(0);
  } catch (err) {
    console.error('Error updating employees:', err);
    process.exit(1);
  }
}

fixTerminatedField();
