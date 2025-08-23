const mongoose = require('mongoose');
const Designation = require('../models/Designation');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

const designations = [
  { name: 'IT Recruiter', status: 'Active' },
  { name: 'Team Lead', status: 'Active' },
  { name: 'Manager', status: 'Active' },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    await Designation.deleteMany({});
    await Designation.insertMany(designations);
    console.log('Designations seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding designations:', err);
    process.exit(1);
  }
}

seed();

