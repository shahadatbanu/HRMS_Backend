import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import auth from '../middleware/auth.js'; // Protect routes

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

// CREATE Employee + User
router.post('/', upload.single('profileImage'), async (req, res) => {
  try {
    const { firstName, lastName, employeeId, joiningDate, username, email, password, phoneNumber, company, department, designation, about, status } = req.body;
    const { bankName, accountNo, ifsc, branch } = req.body;
    
    // Check for existing user/email/username/employeeId
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });
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
    
    // Create User
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, role: 'employee' });
    await user.save();
    
    // Parse other date fields
    const parsedPassportExpiry = parseDate(req.body.passportExpiry);
    const parsedBirthday = parseDate(req.body.birthday);
    const parsedFamilyDateOfBirth = parseDate(req.body.familyInfo?.dateOfBirth);

    // Create Employee
    const employee = new Employee({
      firstName,
      lastName,
      employeeId,
      joiningDate: parsedJoiningDate,
      username,
      email,
      phoneNumber,
      company,
      department,
      designation,
      about,
      status: status || 'Active',
      profileImage: req.file ? req.file.filename : undefined,
      userId: user._id,
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
    res.status(201).json({ message: 'Employee and user created', employee });
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

// GET all employees
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find().populate('userId', 'email role');
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET one employee
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('userId', 'email role');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// UPDATE employee (and user email if provided)
router.put('/:id', upload.single('profileImage'), async (req, res) => {
  try {
    const { firstName, lastName, employeeId, joiningDate, username, email, password, phoneNumber, company, department, designation, about, status } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    
    // Update User only if email is provided and changed
    if (email && employee.userId) {
      const user = await User.findById(employee.userId);
      if (user && email !== user.email) {
        user.email = email;
        await user.save();
      }
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
    
    // Update Employee fields
    employee.firstName = firstName ?? employee.firstName;
    employee.lastName = lastName ?? employee.lastName;
    employee.employeeId = employeeId ?? employee.employeeId;
    employee.joiningDate = parsedJoiningDate ?? employee.joiningDate;
    employee.username = username ?? employee.username;
    employee.email = email ?? employee.email;
    employee.phoneNumber = phoneNumber ?? employee.phoneNumber;
    employee.company = company ?? employee.company;
    employee.department = department ?? employee.department;
    employee.designation = designation ?? employee.designation;
    employee.about = about ?? employee.about;
    employee.status = status ?? employee.status;
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
    res.json({ message: 'Employee and user updated', employee });
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE employee and user
router.delete('/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    await User.findByIdAndDelete(employee.userId);
    await employee.deleteOne();
    res.json({ message: 'Employee and user deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET dashboard statistics
router.get('/stats/dashboard', async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    
    // Count active and inactive employees based on status
    const activeEmployees = await Employee.countDocuments({ status: 'Active' });
    const inactiveEmployees = await Employee.countDocuments({ status: 'Inactive' });
    
    // New joiners in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newJoiners = await Employee.countDocuments({
      joiningDate: { $gte: thirtyDaysAgo }
    });

    // Calculate percentage changes based on previous period
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const thirtyToSixtyDaysAgo = new Date();
    thirtyToSixtyDaysAgo.setDate(thirtyToSixtyDaysAgo.getDate() - 30);

    // Previous period counts
    const previousTotalEmployees = await Employee.countDocuments({
      createdAt: { $lt: thirtyDaysAgo }
    });
    
    const previousActiveEmployees = await Employee.countDocuments({
      status: 'Active',
      createdAt: { $lt: thirtyDaysAgo }
    });
    
    const previousInactiveEmployees = await Employee.countDocuments({
      status: 'Inactive',
      createdAt: { $lt: thirtyDaysAgo }
    });
    
    const previousNewJoiners = await Employee.countDocuments({
      joiningDate: { 
        $gte: thirtyToSixtyDaysAgo,
        $lt: thirtyDaysAgo 
      }
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

export default router; 