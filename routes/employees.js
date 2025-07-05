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
    
    // Check for existing user/email/username/employeeId
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });
    if (await Employee.findOne({ username })) return res.status(400).json({ message: 'Username already exists' });
    if (await Employee.findOne({ employeeId })) return res.status(400).json({ message: 'Employee ID already exists' });
    
    // Create User
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, role: 'employee' });
    await user.save();
    
    // Create Employee
    const employee = new Employee({
      firstName,
      lastName,
      employeeId,
      joiningDate,
      username,
      email,
      phoneNumber,
      company,
      department,
      designation,
      about,
      status: status || 'Active',
      profileImage: req.file ? req.file.filename : undefined,
      userId: user._id
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

// UPDATE employee (and user email/password if provided)
router.put('/:id', upload.single('profileImage'), async (req, res) => {
  try {
    const { firstName, lastName, employeeId, joiningDate, username, email, password, phoneNumber, company, department, designation, about, status } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    
    // Update User if email or password changed
    const user = await User.findById(employee.userId);
    if (email && email !== user.email) user.email = email;
    if (password) user.password = await bcrypt.hash(password, 10);
    await user.save();
    
    // Update Employee fields
    employee.firstName = firstName ?? employee.firstName;
    employee.lastName = lastName ?? employee.lastName;
    employee.employeeId = employeeId ?? employee.employeeId;
    employee.joiningDate = joiningDate ?? employee.joiningDate;
    employee.username = username ?? employee.username;
    employee.email = email ?? employee.email;
    employee.phoneNumber = phoneNumber ?? employee.phoneNumber;
    employee.company = company ?? employee.company;
    employee.department = department ?? employee.department;
    employee.designation = designation ?? employee.designation;
    employee.about = about ?? employee.about;
    employee.status = status ?? employee.status;
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