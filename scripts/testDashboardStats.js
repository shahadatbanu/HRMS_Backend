import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Employee from '../models/Employee.js';

dotenv.config();

const testDashboardStats = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    // Create test users and employees with different dates
    const testData = [
      {
        email: 'emp1@test.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        employeeId: 'EMP-001',
        joiningDate: new Date('2024-01-15'), // Old employee
        username: 'johndoe',
        phoneNumber: '1234567890',
        company: 'Test Company',
        department: 'IT',
        designation: 'Developer',
        about: 'Test employee 1',
        status: 'Active'
      },
      {
        email: 'emp2@test.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
        employeeId: 'EMP-002',
        joiningDate: new Date('2024-02-20'), // Recent employee
        username: 'janesmith',
        phoneNumber: '1234567891',
        company: 'Test Company',
        department: 'HR',
        designation: 'Manager',
        about: 'Test employee 2',
        status: 'Active'
      },
      {
        email: 'emp3@test.com',
        password: 'password123',
        firstName: 'Bob',
        lastName: 'Johnson',
        employeeId: 'EMP-003',
        joiningDate: new Date('2024-03-10'), // Very recent employee
        username: 'bobjohnson',
        phoneNumber: '1234567892',
        company: 'Test Company',
        department: 'Finance',
        designation: 'Accountant',
        about: 'Test employee 3',
        status: 'Inactive'
      }
    ];

    for (const data of testData) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: data.email });
      if (existingUser) {
        console.log(`User ${data.email} already exists, skipping...`);
        continue;
      }

      // Create user
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = new User({ 
        email: data.email, 
        password: hashedPassword, 
        role: 'employee' 
      });
      await user.save();

      // Create employee
      const employee = new Employee({
        ...data,
        userId: user._id
      });
      await employee.save();

      console.log(`Created employee: ${data.firstName} ${data.lastName}`);
    }

    console.log('Test data created successfully!');
    
    // Test the dashboard stats endpoint
    const response = await fetch('http://localhost:5000/api/employees/stats/dashboard', {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    if (response.ok) {
      const stats = await response.json();
      console.log('Dashboard Stats:', stats);
    } else {
      console.log('Failed to fetch dashboard stats');
    }

  } catch (error) {
    console.error('Error creating test data:', error);
  }

  process.exit(0);
};

testDashboardStats(); 