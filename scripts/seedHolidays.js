const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Holiday = require('../models/Holiday.js');
dotenv.config();

const holidays2025 = [
  {
    name: 'New Year’s Day',
    date: '2025-01-01',
    description: 'First day of the year',
  },
  {
    name: 'Makar Sankranti',
    date: '2025-01-14',
    description: 'Harvest festival',
  },
  {
    name: 'Republic Day',
    date: '2025-01-26',
    description: 'Commemorates the adoption of the Constitution of India',
  },
  {
    name: 'Holi',
    date: '2025-03-14',
    description: 'Festival of colors',
  },
  {
    name: 'Good Friday',
    date: '2025-04-18',
    description: 'Christian holiday',
  },
  {
    name: 'Mahavir Jayanti',
    date: '2025-04-10',
    description: 'Jain festival',
  },
  {
    name: 'Independence Day',
    date: '2025-08-15',
    description: 'Marks India’s independence from British rule',
  },
  {
    name: 'Raksha Bandhan',
    date: '2025-08-09',
    description: 'Festival celebrating the bond between brothers and sisters',
  },
  {
    name: 'Janmashtami',
    date: '2025-08-16',
    description: 'Birthday of Lord Krishna',
  },
  {
    name: 'Gandhi Jayanti',
    date: '2025-10-02',
    description: 'Birthday of Mahatma Gandhi',
  },
  {
    name: 'Dussehra (Vijayadashami)',
    date: '2025-10-02',
    description: 'Festival celebrating the victory of good over evil',
  },
  {
    name: 'Diwali (Deepavali)',
    date: '2025-10-21',
    description: 'Festival of lights',
  },
  {
    name: 'Christmas Eve',
    date: '2025-12-24',
    description: 'Christian holiday',
  },
  {
    name: 'Christmas Day',
    date: '2025-12-25',
    description: 'Christian holiday',
  },
];

async function seedHolidays() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Remove existing holidays for 2025
    await Holiday.deleteMany({
      date: { $gte: '2025-01-01', $lte: '2025-12-31' },
    });

    // Insert new holidays
    await Holiday.insertMany(holidays2025);
    console.log('Seeded Indian national holidays for 2025');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding holidays:', err);
    process.exit(1);
  }
}

seedHolidays();








