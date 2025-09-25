const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const Employee = require('../models/Employee.js');
const auth = require('../middleware/auth.js'); // Protect routes
const ActivityService = require('../services/activityService.js');

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

// Separate multer for attachments (allow common docs & images)
const attachmentFileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

const uploadAttachment = multer({
  storage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
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
      if (!dateString || dateString.trim() === '') return null;
      
      // Check if the date string matches DD-MM-YYYY format
      const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
      const match = dateString.match(dateRegex);
      
      if (!match) {
        console.log('Date format validation failed for:', dateString);
        return null;
      }
      
      const [, day, month, year] = match;
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      
      // Validate day, month, year ranges
      if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) {
        console.log('Date range validation failed for:', dateString);
        return null;
      }
      
      const parsedDate = new Date(yearNum, monthNum - 1, dayNum); // month is 0-indexed in Date constructor
      
      // Validate the date (check if it's a valid date and matches input)
      if (isNaN(parsedDate.getTime()) || 
          parsedDate.getDate() !== dayNum || 
          parsedDate.getMonth() !== (monthNum - 1) || 
          parsedDate.getFullYear() !== yearNum) {
        console.log('Date validation failed for:', dateString);
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
    
    // Log activity
    try {
      await ActivityService.logEmployeeAdded(
        req.user.id,
        employee._id,
        `${employee.firstName} ${employee.lastName}`
      );
    } catch (activityError) {
      console.error('Error logging employee creation activity:', activityError);
    }
    
    res.status(201).json({ message: 'Employee created successfully', employee });
  } catch (err) {
    console.error('Error creating employee:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const employee = await Employee.findById(req.user._id).select('-password');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Asset image upload endpoint
router.post('/upload/asset-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }
    
    const imageUrl = req.file.filename;
    res.json({ 
      message: 'Asset image uploaded successfully',
      imageUrl: imageUrl
    });
  } catch (error) {
    console.error('Asset image upload error:', error);
    res.status(500).json({ message: 'Failed to upload asset image' });
  }
});

// Attachment upload endpoint
router.post('/upload/attachment', uploadAttachment.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }
    res.json({
      message: 'Attachment uploaded successfully',
      fileName: req.file.originalname,
      filePath: req.file.filename,
      fileType: req.file.mimetype
    });
  } catch (error) {
    console.error('Attachment upload error:', error);
    res.status(500).json({ message: 'Failed to upload attachment' });
  }
});

// Delete attachment endpoint
router.delete('/:id/attachments/:attachmentIndex', async (req, res) => {
  try {
    const { id, attachmentIndex } = req.params;
    const index = parseInt(attachmentIndex);
    
    if (isNaN(index)) {
      return res.status(400).json({ message: 'Invalid attachment index' });
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (!employee.attachments || index >= employee.attachments.length || index < 0) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const attachment = employee.attachments[index];
    
    // Remove the attachment from the array
    employee.attachments.splice(index, 1);
    await employee.save();

    // Optionally delete the physical file (commented out for safety)
    // const fs = require('fs');
    // const path = require('path');
    // const filePath = path.join(__dirname, '../uploads', attachment.filePath);
    // if (fs.existsSync(filePath)) {
    //   fs.unlinkSync(filePath);
    // }

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Attachment deletion error:', error);
    res.status(500).json({ message: 'Failed to delete attachment' });
  }
});

// Secure attachment download for the logged-in employee only
router.get('/attachments/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    // Find current employee with attachments
    const me = await Employee.findById(req.user._id).select('attachments firstName lastName');
    if (!me) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check ownership of the requested file
    const att = (me.attachments || []).find(a => a.filePath === fileName);
    if (!att) {
      return res.status(403).json({ message: 'You are not authorized to access this file' });
    }

    const path = require('path');
    const fs = require('fs');
    const absolutePath = path.join(__dirname, '..', 'uploads', fileName);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Set headers and stream
    const mime = require('mime-types');
    const contentType = att.fileType || mime.lookup(fileName) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${att.fileName || fileName}"`);

    const stream = fs.createReadStream(absolutePath);
    stream.on('error', () => res.status(500).end());
    stream.pipe(res);
  } catch (error) {
    console.error('Secure attachment download error:', error);
    res.status(500).json({ message: 'Failed to download attachment' });
  }
});

// List my attachments with pagination
router.get('/me/attachments', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const me = await Employee.findById(req.user._id).select('attachments lastSeenAttachmentsAt seenAttachmentFiles');
    if (!me) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Sort newest first by uploadedOn (fallback to filePath)
    const attachments = (me.attachments || []).slice().sort((a, b) => {
      const at = a.uploadedOn ? new Date(a.uploadedOn).getTime() : 0;
      const bt = b.uploadedOn ? new Date(b.uploadedOn).getTime() : 0;
      if (bt !== at) return bt - at;
      const af = (a.filePath || '').toLowerCase();
      const bf = (b.filePath || '').toLowerCase();
      return af < bf ? -1 : af > bf ? 1 : 0;
    });

    const total = attachments.length;
    const lastSeen = me.lastSeenAttachmentsAt ? new Date(me.lastSeenAttachmentsAt).getTime() : 0;
    const seenSet = new Set(me.seenAttachmentFiles || []);
    const newCount = attachments.filter(a => {
      const ts = a.uploadedOn ? new Date(a.uploadedOn).getTime() : 0;
      // Consider new only if newer than lastSeen AND not individually marked as seen
      return (ts > lastSeen) && !seenSet.has(a.filePath);
    }).length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const data = attachments.slice(start, end).map(a => ({
      ...a.toObject ? a.toObject() : a,
      isNew: (((a.uploadedOn ? new Date(a.uploadedOn).getTime() : 0) > lastSeen) && !seenSet.has(a.filePath))
    }));

    res.json({ success: true, data, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), lastSeenAttachmentsAt: me.lastSeenAttachmentsAt || null, newCount });
  } catch (error) {
    console.error('List attachments error:', error);
    res.status(500).json({ success: false, message: 'Failed to list attachments' });
  }
});

// Mark all attachments seen (set lastSeenAttachmentsAt to now)
router.post('/me/attachments/mark-seen', async (req, res) => {
  try {
    const me = await Employee.findById(req.user._id).select('_id');
    if (!me) return res.status(404).json({ success: false, message: 'Employee not found' });
    const now = new Date();
    await Employee.updateOne({ _id: me._id }, { $set: { lastSeenAttachmentsAt: now } });
    res.json({ success: true, lastSeenAttachmentsAt: now });
  } catch (error) {
    console.error('Mark seen error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark attachments as seen' });
  }
});

// Mark a specific attachment as seen by filePath
router.post('/me/attachments/:filePath/mark-seen', async (req, res) => {
  try {
    const { filePath } = req.params;
    if (!filePath) return res.status(400).json({ success: false, message: 'filePath required' });
    const me = await Employee.findById(req.user._id).select('_id seenAttachmentFiles');
    if (!me) return res.status(404).json({ success: false, message: 'Employee not found' });
    const decoded = decodeURIComponent(filePath);
    await Employee.updateOne({ _id: me._id }, { $addToSet: { seenAttachmentFiles: decoded } });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark single seen error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark attachment as seen' });
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
    
    // Add date filtering for new hires
    if (req.query.startDate && req.query.endDate) {
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(req.query.endDate);
      endDate.setHours(23, 59, 59, 999); // Set to end of day
      
      filter.joiningDate = {
        $gte: startDate,
        $lte: endDate
      };
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
      if (!dateString || dateString.trim() === '') return null;
      
      // Check if the date string matches DD-MM-YYYY format
      const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
      const match = dateString.match(dateRegex);
      
      if (!match) {
        console.log('Date format validation failed for:', dateString);
        return null;
      }
      
      const [, day, month, year] = match;
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      
      // Validate day, month, year ranges
      if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) {
        console.log('Date range validation failed for:', dateString);
        return null;
      }
      
      const parsedDate = new Date(yearNum, monthNum - 1, dayNum); // month is 0-indexed in Date constructor
      
      // Validate the date (check if it's a valid date and matches input)
      if (isNaN(parsedDate.getTime()) || 
          parsedDate.getDate() !== dayNum || 
          parsedDate.getMonth() !== (monthNum - 1) || 
          parsedDate.getFullYear() !== yearNum) {
        console.log('Date validation failed for:', dateString);
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
    // Update assets (admin/hr only)
    if (req.body.assets && (req.user?.role === 'admin' || req.user?.role === 'hr')) {
      employee.assets = req.body.assets.map(a => ({
        itemName: a.itemName,
        assetCode: a.assetCode,
        image: a.image,
        assignedBy: a.assignedBy,
        assignedOn: a.assignedOn ? new Date(a.assignedOn) : undefined,
        note: a.note,
      }));
    }
  // Update attachments (admin/hr only)
  if (req.body.attachments && (req.user?.role === 'admin' || req.user?.role === 'hr')) {
    employee.attachments = req.body.attachments.map(att => ({
      fileName: att.fileName,
      filePath: att.filePath,
      fileType: att.fileType,
      uploadedBy: att.uploadedBy,
      uploadedOn: att.uploadedOn ? new Date(att.uploadedOn) : undefined,
      note: att.note,
    }));
  }
    if (req.file) employee.profileImage = req.file.filename;
    await employee.save();
    
    // Log activity
    try {
      await ActivityService.logEmployeeUpdated(
        req.user.id,
        employee._id,
        `${employee.firstName} ${employee.lastName}`
      );
    } catch (activityError) {
      console.error('Error logging employee update activity:', activityError);
    }
    
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

// GET upcoming birthdays for dashboard
router.get('/birthdays/dashboard', async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    
    // Get employees with birthdays in the next 30 days (excluding soft deleted)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const employees = await Employee.find({
      isDeleted: { $ne: true },
      birthday: { $exists: true, $ne: null }
    })
    .select('firstName lastName designation profileImage birthday')
    .sort({ birthday: 1 });
    
    // Group employees by birthday category
    const birthdays = {
      today: [],
      tomorrow: [],
      upcoming: []
    };
    
    employees.forEach(employee => {
      if (!employee.birthday) return;
      
      const birthday = new Date(employee.birthday);
      
      // Get local date components (without time)
      const birthdayMonth = birthday.getMonth();
      const birthdayDay = birthday.getDate();
      
      // Create today's date without time component
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      // Set this year's birthday without time component
      const thisYearBirthday = new Date(today.getFullYear(), birthdayMonth, birthdayDay);
      
      // If this year's birthday has passed, check next year's birthday
      let nextBirthday = thisYearBirthday;
      if (thisYearBirthday < todayDate) {
        nextBirthday = new Date(today.getFullYear() + 1, birthdayMonth, birthdayDay);
      }
      
      // Calculate days until birthday using date-only comparison
      const daysUntilBirthday = Math.ceil((nextBirthday - todayDate) / (1000 * 60 * 60 * 24));
      
      // Only include birthdays in the next 30 days
      if (daysUntilBirthday <= 30) {
        const employeeData = {
          _id: employee._id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          fullName: `${employee.firstName} ${employee.lastName}`,
          designation: employee.designation,
          profileImage: employee.profileImage,
          birthday: nextBirthday,
          daysUntil: daysUntilBirthday
        };
        
        if (daysUntilBirthday === 0) {
          birthdays.today.push(employeeData);
        } else if (daysUntilBirthday === 1) {
          birthdays.tomorrow.push(employeeData);
        } else {
          birthdays.upcoming.push(employeeData);
        }
      }
    });
    
    // Sort upcoming birthdays by date
    birthdays.upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    
    res.json({
      success: true,
      data: birthdays
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
});

// GET yearly birthdays for full year view
router.get('/birthdays/yearly', async (req, res) => {
  try {
    const { year } = req.query;
    const selectedYear = parseInt(year) || new Date().getFullYear();
    const today = new Date();
    
    const employees = await Employee.find({
      isDeleted: { $ne: true },
      birthday: { $exists: true, $ne: null }
    })
    .select('firstName lastName designation profileImage birthday')
    .sort({ birthday: 1 });
    
    const monthlyBirthdays = {};
    
    // Initialize all months
    for (let i = 1; i <= 12; i++) {
      monthlyBirthdays[i.toString().padStart(2, '0')] = [];
    }
    
    employees.forEach(employee => {
      if (!employee.birthday) return;
      
      const birthday = new Date(employee.birthday);
      const birthdayMonth = birthday.getMonth();
      const birthdayDay = birthday.getDate();
      
      // Create birthday for the selected year
      const yearBirthday = new Date(selectedYear, birthdayMonth, birthdayDay);
      
      // Calculate days until birthday (considering if it's this year or next year)
      let daysUntil = Math.ceil((yearBirthday - today) / (1000 * 60 * 60 * 24));
      
      // If the birthday has passed this year, calculate for next year
      if (daysUntil < 0 && selectedYear === today.getFullYear()) {
        const nextYearBirthday = new Date(selectedYear + 1, birthdayMonth, birthdayDay);
        daysUntil = Math.ceil((nextYearBirthday - today) / (1000 * 60 * 60 * 24));
      }
      
      const employeeData = {
        _id: employee._id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.firstName} ${employee.lastName}`,
        designation: employee.designation,
        profileImage: employee.profileImage,
        birthday: yearBirthday,
        daysUntil: daysUntil
      };
      
      const monthKey = (birthdayMonth + 1).toString().padStart(2, '0');
      monthlyBirthdays[monthKey].push(employeeData);
    });
    
    // Sort employees within each month by day
    Object.keys(monthlyBirthdays).forEach(monthKey => {
      monthlyBirthdays[monthKey].sort((a, b) => {
        const dayA = new Date(a.birthday).getDate();
        const dayB = new Date(b.birthday).getDate();
        return dayA - dayB;
      });
    });
    
    res.json({
      success: true,
      data: monthlyBirthdays
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
});

// GET employee statistics by designation
router.get('/stats/designations', async (req, res) => {
  try {
    const { period } = req.query; // 'week', 'month', 'year', or 'all'
    
    let dateFilter = {};
    
    // Apply date filtering based on period
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { joiningDate: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { joiningDate: { $gte: monthAgo } };
    } else if (period === 'year') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      dateFilter = { joiningDate: { $gte: yearAgo } };
    }
    // For 'all' or no period specified, no date filter is applied
    
    // Get official designations first
    const Designation = require('../models/Designation.js');
    const officialDesignations = await Designation.find({ status: 'Active' }).sort({ name: 1 });
    const officialDesignationNames = officialDesignations.map(d => d.name);
    
    // Get employee count by designation (only for official designations)
    const designationStats = await Employee.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          designation: { $in: officialDesignationNames },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$designation',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Get total employees for percentage calculation (only official designations)
    const totalEmployees = await Employee.countDocuments({
      isDeleted: { $ne: true },
      designation: { $in: officialDesignationNames },
      ...dateFilter
    });
    
    // Calculate percentage change from previous month (monthly basis)
    let previousMonthTotal = 0;
    
    // Calculate current month and previous month date ranges
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Get total employees from previous month
    previousMonthTotal = await Employee.countDocuments({
      isDeleted: { $ne: true },
      designation: { $in: officialDesignationNames },
      joiningDate: { 
        $gte: previousMonthStart,
        $lte: previousMonthEnd
      }
    });
    
    // Calculate percentage change from previous month
    const percentageChange = previousMonthTotal > 0 
      ? ((totalEmployees - previousMonthTotal) / previousMonthTotal) * 100 
      : 0;
    
    // Include all official designations (even those with 0 employees)
    const allDesignationStats = officialDesignationNames.map(designationName => {
      const existingStat = designationStats.find(stat => stat._id === designationName);
      return {
        _id: designationName,
        count: existingStat ? existingStat.count : 0
      };
    }).sort((a, b) => b.count - a.count); // Sort by count descending

    res.json({
      success: true,
      data: {
        designations: allDesignationStats,
        total: totalEmployees,
        percentageChange: Math.round(percentageChange * 10) / 10, // Round to 1 decimal place
        period: period || 'all'
      }
    });
  } catch (err) {
    console.error('Error fetching designation stats:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
});

module.exports = router; 