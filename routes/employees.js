const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const Employee = require('../models/Employee.js');
const auth = require('../middleware/auth.js'); // Protect routes

const router = express.Router();

// Multer setup for profile image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 4 * 1024 * 1024 // 4MB limit
  }
});

// Protect all employee routes
router.use(auth);

// CREATE Employee (Single Schema)
router.post('/', upload.single('profileImage'), async (req, res) => {
  try {
    const { firstName, lastName, employeeId, joiningDate, username, email, password, phoneNumber, company, department, designation, about, status } = req.body;
    const { bankName, accountNo, ifsc, branch } = req.body;
    
    // Check for existing email/username/employeeId
    if (await Employee.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });
    if (await Employee.findOne({ username })) return res.status(400).json({ message: 'Username already exists' });
    if (await Employee.findOne({ employeeId })) return res.status(400).json({ message: 'Employee ID already exists' });
    
    // Parse date fields from DD-MM-YYYY format to Date objects
    const parseDate = (dateString) => {
      if (!dateString) return null;
      const [day, month, year] = dateString.split('-');
      const parsedDate = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
      
      // Validate the date
      if (isNaN(parsedDate.getTime())) {
        return null;
      }
      return parsedDate;
    };

    let parsedJoiningDate = parseDate(joiningDate);
    if (joiningDate && !parsedJoiningDate) {
      return res.status(400).json({ message: 'Invalid joining date format. Please use DD-MM-YYYY format.' });
    }
    
    // Hash password for Employee schema
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Parse other date fields
    const parsedPassportExpiry = parseDate(req.body.passportExpiry);
    const parsedBirthday = parseDate(req.body.birthday);
    const parsedFamilyDateOfBirth = parseDate(req.body.familyInfo?.dateOfBirth);

    // Create Employee (Single Schema)
    const employee = new Employee({
      // Authentication fields
      email,
      password: hashedPassword,
      role: 'employee',
      isActive: true,
      
      // Employee fields
      firstName,
      lastName,
      employeeId,
      joiningDate: parsedJoiningDate,
      username,
      phoneNumber,
      company,
      department,
      designation,
      about,
      status: status || 'Active',
      profileImage: req.file ? req.file.filename : undefined,
      bankName,
      accountNo,
      ifsc,
      branch,
      passportExpiry: parsedPassportExpiry,
      birthday: parsedBirthday,
      familyInfo: req.body.familyInfo ? {
        ...req.body.familyInfo,
        dateOfBirth: parsedFamilyDateOfBirth
      } : undefined
    });
    await employee.save();
    res.status(201).json({ message: 'Employee created successfully', employee });
  } catch (err) {
    console.error('Error creating employee:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size too large. Maximum size is 4MB.' });
    }
    return res.status(400).json({ message: 'File upload error: ' + error.message });
  }
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({ message: error.message });
  }
  next(error);
});

// GET all employees (optionally only active)
router.get('/', async (req, res) => {
  try {
    const filter = { isDeleted: { $ne: true } };
    if (req.query.activeOnly === 'true') {
      filter.terminated = false;
    }
    const employees = await Employee.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET one employee (excluding soft deleted)
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).select('-password');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// UPDATE employee
router.put('/:id', upload.single('profileImage'), async (req, res) => {
  try {
    const { firstName, lastName, employeeId, joiningDate, username, email, password, phoneNumber, company, department, designation, about, status } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    
    // Check for unique field conflicts (only if values are being changed)
    if (email && email !== employee.email) {
      const existingEmail = await Employee.findOne({ email, _id: { $ne: req.params.id } });
      if (existingEmail) return res.status(400).json({ message: 'Email already exists' });
    }
    
    if (username && username !== employee.username) {
      const existingUsername = await Employee.findOne({ username, _id: { $ne: req.params.id } });
      if (existingUsername) return res.status(400).json({ message: 'Username already exists' });
    }
    
    if (employeeId && employeeId !== employee.employeeId) {
      const existingEmployeeId = await Employee.findOne({ employeeId, _id: { $ne: req.params.id } });
      if (existingEmployeeId) return res.status(400).json({ message: 'Employee ID already exists' });
    }
    
    // Parse date fields from DD-MM-YYYY format to Date objects
    const parseDate = (dateString) => {
      if (!dateString) return null;
      const [day, month, year] = dateString.split('-');
      const parsedDate = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
      
      // Validate the date
      if (isNaN(parsedDate.getTime())) {
        return null;
      }
      return parsedDate;
    };

    let parsedJoiningDate = parseDate(joiningDate);
    let parsedPassportExpiry = parseDate(req.body.passportExpiry);
    let parsedBirthday = parseDate(req.body.birthday);
    let parsedFamilyDateOfBirth = parseDate(req.body.familyInfo?.dateOfBirth);

    // Validate dates if provided
    if (joiningDate && !parsedJoiningDate) {
      return res.status(400).json({ message: 'Invalid joining date format. Please use DD-MM-YYYY format.' });
    }
    if (req.body.passportExpiry && !parsedPassportExpiry) {
      return res.status(400).json({ message: 'Invalid passport expiry date format. Please use DD-MM-YYYY format.' });
    }
    if (req.body.birthday && !parsedBirthday) {
      return res.status(400).json({ message: 'Invalid birthday format. Please use DD-MM-YYYY format.' });
    }
    if (req.body.familyInfo?.dateOfBirth && !parsedFamilyDateOfBirth) {
      return res.status(400).json({ message: 'Invalid family member date of birth format. Please use DD-MM-YYYY format.' });
    }
    
    // Update authentication fields
    if (email) employee.email = email;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      employee.password = hashedPassword;
    }
    if (req.body.role) employee.role = req.body.role;
    if (req.body.isActive !== undefined) employee.isActive = req.body.isActive;
    
    // Update Employee fields
    employee.firstName = firstName ?? employee.firstName;
    employee.lastName = lastName ?? employee.lastName;
    employee.employeeId = employeeId ?? employee.employeeId;
    employee.joiningDate = parsedJoiningDate ?? employee.joiningDate;
    employee.username = username ?? employee.username;
    employee.phoneNumber = phoneNumber ?? employee.phoneNumber;
    employee.company = company ?? employee.company;
    employee.department = department ?? employee.department;
    employee.designation = designation ?? employee.designation;
    employee.about = about ?? employee.about;
    employee.status = status ?? employee.status;
    // Allow updating terminated bit
    if (req.body.terminated !== undefined) employee.terminated = req.body.terminated;
    // Update bank details
    employee.bankName = req.body.bankName ?? employee.bankName;
    employee.accountNo = req.body.accountNo ?? employee.accountNo;
    employee.ifsc = req.body.ifsc ?? employee.ifsc;
    employee.branch = req.body.branch ?? employee.branch;
    // Update personal information
    employee.passportNumber = req.body.passportNumber ?? employee.passportNumber;
    employee.passportExpiry = parsedPassportExpiry ?? employee.passportExpiry;
    employee.nationality = req.body.nationality ?? employee.nationality;
    employee.religion = req.body.religion ?? employee.religion;
    employee.maritalStatus = req.body.maritalStatus ?? employee.maritalStatus;
    employee.spouseEmployment = req.body.spouseEmployment ?? employee.spouseEmployment;
    employee.childrenCount = req.body.childrenCount ?? employee.childrenCount;
    employee.gender = req.body.gender ?? employee.gender;
    employee.birthday = parsedBirthday ?? employee.birthday;
    employee.address = req.body.address ?? employee.address;
    // Update emergency contacts
    if (req.body.emergencyContacts) employee.emergencyContacts = req.body.emergencyContacts;
    // Update family information
    if (req.body.familyInfo) {
      employee.familyInfo = {
        ...req.body.familyInfo,
        dateOfBirth: parsedFamilyDateOfBirth ?? employee.familyInfo?.dateOfBirth
      };
    }
    // Update education details
    if (req.body.education) employee.education = req.body.education;
    // Update experience details
    if (req.body.experience) employee.experience = req.body.experience;
    if (req.file) employee.profileImage = req.file.filename;
    await employee.save();
    res.json({ message: 'Employee updated successfully', employee });
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// SOFT DELETE employee
router.delete('/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    
    // Soft delete - mark as deleted instead of removing from database
    employee.isDeleted = true;
    employee.deletedAt = new Date();
    employee.deletedBy = req.user?.id; // If available from auth middleware
    employee.deletionReason = req.body.reason || 'Deleted by administrator';
    
    await employee.save();
    res.json({ message: 'Employee soft deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// RESTORE soft deleted employee (Admin only)
router.patch('/:id/restore', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    
    if (!employee.isDeleted) {
      return res.status(400).json({ message: 'Employee is not deleted' });
    }
    
    // Restore the employee
    employee.isDeleted = false;
    employee.deletedAt = undefined;
    employee.deletedBy = undefined;
    employee.deletionReason = undefined;
    
    await employee.save();
    res.json({ message: 'Employee restored successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET soft deleted employees (Admin only)
router.get('/deleted', async (req, res) => {
  try {
    const deletedEmployees = await Employee.find({ isDeleted: true })
      .select('-password')
      .populate('deletedBy', 'firstName lastName email')
      .sort({ deletedAt: -1 });
    
    res.json(deletedEmployees);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET dashboard statistics (excluding soft deleted)
router.get('/stats/dashboard', async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments({ isDeleted: { $ne: true } });
    
    // Count active and inactive employees based on status (excluding soft deleted)
    const activeEmployees = await Employee.countDocuments({ status: 'Active', isDeleted: { $ne: true } });
    const inactiveEmployees = await Employee.countDocuments({ status: 'Inactive', isDeleted: { $ne: true } });
    
    // New joiners in the last 30 days (excluding soft deleted)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newJoiners = await Employee.countDocuments({
      joiningDate: { $gte: thirtyDaysAgo },
      isDeleted: { $ne: true }
    });

    // Calculate percentage changes based on previous period
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const thirtyToSixtyDaysAgo = new Date();
    thirtyToSixtyDaysAgo.setDate(thirtyToSixtyDaysAgo.getDate() - 30);

    // Previous period counts (excluding soft deleted)
    const previousTotalEmployees = await Employee.countDocuments({
      createdAt: { $lt: thirtyDaysAgo },
      isDeleted: { $ne: true }
    });
    
    const previousActiveEmployees = await Employee.countDocuments({
      status: 'Active',
      createdAt: { $lt: thirtyDaysAgo },
      isDeleted: { $ne: true }
    });
    
    const previousInactiveEmployees = await Employee.countDocuments({
      status: 'Inactive',
      createdAt: { $lt: thirtyDaysAgo },
      isDeleted: { $ne: true }
    });
    
    const previousNewJoiners = await Employee.countDocuments({
      joiningDate: { 
        $gte: thirtyToSixtyDaysAgo,
        $lt: thirtyDaysAgo 
      },
      isDeleted: { $ne: true }
    });

    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (previous === 0) {
        return current > 0 ? '+100.00%' : '0.00%';
      }
      const change = ((current - previous) / previous) * 100;
      const sign = change >= 0 ? '+' : '';
      return `${sign}${change.toFixed(2)}%`;
    };

    const totalChange = calculatePercentageChange(totalEmployees, previousTotalEmployees);
    const activeChange = calculatePercentageChange(activeEmployees, previousActiveEmployees);
    const inactiveChange = calculatePercentageChange(inactiveEmployees, previousInactiveEmployees);
    const newJoinersChange = calculatePercentageChange(newJoiners, previousNewJoiners);

    res.json({
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      newJoiners,
      totalChange,
      activeChange,
      inactiveChange,
      newJoinersChange
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router; 