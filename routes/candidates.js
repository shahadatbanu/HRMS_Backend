const express = require('express');
const multer = require('multer');
const Candidate = require('../models/Candidate.js');
const Counter = require('../models/Counter.js');
const Employee = require('../models/Employee.js');
const auth = require('../middleware/auth.js');
const role = require('../middleware/role.js');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const router = express.Router();

// Function to generate next candidate ID
async function getNextCandidateId() {
  try {
    const counter = await Counter.findByIdAndUpdate(
      'candidate',
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true }
    );
    
    // Format the ID as Cand-001, Cand-002, etc.
    const paddedNumber = counter.sequence_value.toString().padStart(3, '0');
    return `Cand-${paddedNumber}`;
  } catch (error) {
    console.error('Error generating candidate ID:', error);
    throw new Error('Failed to generate candidate ID');
  }
}

// Ensure uploads/candidates directory exists
const uploadsDir = 'uploads/candidates';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for CV upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Get file extension
    const ext = path.extname(file.originalname);
    // Get filename without extension
    const nameWithoutExt = path.basename(file.originalname, ext);
    // Create a shorter unique identifier
    const uniqueId = Date.now().toString().slice(-6) + '-' + Math.round(Math.random() * 1000);
    // Create clean filename: originalname-uniqueid.ext
    const cleanFilename = `${nameWithoutExt}-${uniqueId}${ext}`;
    cb(null, cleanFilename);
  }
});

const fileFilter = (req, file, cb) => {
  // For CV files, accept PDF, DOC, DOCX files
  if (file.fieldname === 'cvFile') {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed for CV!'), false);
    }
  }
  // For profile images, accept image files
  else if (file.fieldname === 'profileImage') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for profile image!'), false);
    }
  }
  // For attachments, accept a broader range of file types
  else if (file.fieldname === 'file') {
    const allowedTypes = [
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      // Other common types
      'application/json',
      'text/xml',
      'application/xml'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not supported for attachments. Please upload a supported file type.`), false);
    }
  }
  // For any other files, reject
  else {
    cb(new Error('Unsupported file type!'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Protect all candidate routes
router.use(auth);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error);
    return res.status(400).json({
      success: false,
      message: `File upload error: ${error.message}`
    });
  } else if (error) {
    console.error('Other error:', error);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  next();
});

// GET all employees for recruiter dropdown
router.get('/employees/recruiters', async (req, res) => {
  try {
    const employees = await Employee.find({ status: 'Active' })
      .select('firstName lastName email designation department')
      .sort({ firstName: 1, lastName: 1 });
    
    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// CREATE - HR or Admin creates candidate profile
router.post('/', (req, res, next) => {
  // Allow both admin and hr roles
  if (req.user && (req.user.role === 'hr' || req.user.role === 'admin')) {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Only HR and Admin can create candidates.' });
  }
}, upload.fields([
  { name: 'cvFile', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Creating candidate with data:', req.body);
    console.log('Files received:', req.files);
    
    // Generate next candidate ID
    const candidateId = await getNextCandidateId();
    
    // Parse JSON strings back to arrays and objects
    const candidateData = {
      ...req.body,
      candidateId: candidateId,
      cvFile: req.files?.cvFile ? req.files.cvFile[0].filename : undefined,
      profileImage: req.files?.profileImage ? req.files.profileImage[0].filename : undefined,
      assignedBy: req.user.id,
      recruiter: req.body.recruiter || undefined,
      // If recruiter is provided, also set assignedTo to the same value
      assignedTo: req.body.recruiter || undefined,
      assignedDate: req.body.recruiter ? Date.now() : undefined,
      // Parse address object from JSON string
      address: req.body.address ? JSON.parse(req.body.address) : {},
      // Parse arrays from JSON strings
      education: req.body.education ? JSON.parse(req.body.education) : [],
      certifications: req.body.certifications ? JSON.parse(req.body.certifications) : [],
      experience: req.body.experience ? JSON.parse(req.body.experience) : [],
      techStack: req.body.techStack ? JSON.parse(req.body.techStack) : [],
      statusHistory: [{
        status: 'New',
        changedBy: req.user.id,
        notes: 'Profile created by HR'
      }]
    };

    console.log('Processed candidate data:', candidateData);

    const candidate = new Candidate(candidateData);
    await candidate.save();

    console.log('Candidate saved successfully:', candidate._id);

    res.status(201).json({
      success: true,
      data: candidate,
      message: 'Candidate profile created successfully'
    });
  } catch (error) {
    console.error('Error creating candidate:', error);
    
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      let message = '';
      
      if (field === 'email') {
        message = 'A candidate with this email address already exists. Please use a different email address.';
      } else {
        message = `A candidate with this ${field} already exists.`;
      }
      
      return res.status(400).json({
        success: false,
        message: message,
        error: 'DUPLICATE_KEY',
        field: field
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Please check your input and ensure all required fields are filled correctly.',
        errors: validationErrors
      });
    }
    
    // Handle file upload errors
    if (error.message.includes('file') || error.message.includes('upload')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(400).json({
      success: false,
      message: error.message || 'Error creating candidate profile'
    });
  }
});

// GET ALL - With filters and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      assignedTo, 
      search,
      experience,
      techStack,
      dateFrom,
      dateTo
    } = req.query;

    const filter = {};

    // Role-based filtering
    // If user is employee, only show candidates assigned to them
    if (req.user && req.user.role === 'employee') {
      console.log('🔍 Debug - req.user:', req.user);
      
      // Get the current employee directly (since we're now using Employee for auth)
      const employeeId = req.user._id || req.user.id || req.user.userId;
      console.log('🔍 Debug - employeeId:', employeeId);
      
      const employee = await Employee.findById(employeeId);
      console.log('🔍 Debug - employee found:', employee ? 'Yes' : 'No');
      
      if (!employee) {
        return res.status(400).json({
          success: false,
          message: 'Employee profile not found. Please contact administrator.'
        });
      }
      
      // Filter to show candidates assigned to this employee (only check assignedTo field)
      filter.assignedTo = employee._id;
      console.log('🔍 Debug - filter.assignedTo:', filter.assignedTo);
    }

    // Status filter
    if (status) filter.status = status;

    // Assignment filter (only for admin/hr roles)
    if (assignedTo && (req.user.role === 'admin' || req.user.role === 'hr')) {
      filter.assignedTo = assignedTo;
    }

    // Experience filter
    if (experience) filter.yearsOfExperience = { $gte: parseInt(experience) };

    // Tech stack filter
    if (techStack) {
      filter['techStack.skills'] = { $in: [techStack] };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Search filter
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { appliedRole: { $regex: search, $options: 'i' } }
      ];
    }

    const candidates = await Candidate.find({ ...filter, isDeleted: { $ne: true } })
      .populate('assignedTo', 'firstName lastName email profileImage')
      .populate('assignedBy', 'firstName lastName email profileImage')
      .populate('recruiter', 'firstName lastName email profileImage designation')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Candidate.countDocuments({ ...filter, isDeleted: { $ne: true } });

    res.json({
      success: true,
      data: candidates,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        totalRecords: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET BY ID
router.get('/:id', async (req, res) => {
  try {
    console.log('🔍 Individual candidate request - req.params.id:', req.params.id);
    console.log('🔍 Individual candidate request - req.user:', req.user);
    
    const candidate = await Candidate.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      .populate('assignedTo', 'firstName lastName email profileImage')
      .populate('assignedBy', 'firstName lastName email profileImage')
      .populate('recruiter', 'firstName lastName email profileImage designation')
      .populate('notes.createdBy', 'firstName lastName profileImage email designation')
      .populate('bgCheckNotes.createdBy', 'firstName lastName profileImage email designation')
      .populate('attachments.uploadedBy', 'firstName lastName profileImage email designation')
      .populate('submissions.createdBy', 'firstName lastName profileImage email designation')
      .populate('interviews.createdBy', 'firstName lastName profileImage email designation')
      .populate('offerDetails.createdBy', 'firstName lastName profileImage email designation')
      .populate('offerDetails.updatedBy', 'firstName lastName profileImage email designation');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Role-based access control
    // If user is employee, check if they are assigned to this candidate
    if (req.user && req.user.role === 'employee') {
      console.log('🔍 Debug - req.user:', req.user);
      
      // Get the current employee directly (since we're now using Employee for auth)
      const userEmployeeId = req.user._id || req.user.id || req.user.userId;
      console.log('🔍 Debug - userEmployeeId:', userEmployeeId);
      
      const employee = await Employee.findById(userEmployeeId);
      console.log('🔍 Debug - employee found:', employee ? 'Yes' : 'No');
      
      if (!employee) {
        return res.status(400).json({
          success: false,
          message: 'Employee profile not found. Please contact administrator.'
        });
      }
      
      // Check if the candidate is assigned to this employee (only check assignedTo field)
      console.log('🔍 Debug - candidate.assignedTo:', candidate.assignedTo);
      console.log('🔍 Debug - employee._id:', employee._id);
      
      // More robust comparison - handle populated object
      const candidateAssignedToId = candidate.assignedTo?._id || candidate.assignedTo;
      const candidateAssignedTo = candidateAssignedToId?.toString();
      const employeeIdString = employee._id.toString();
      
      console.log('🔍 Debug - candidateAssignedTo:', candidateAssignedTo);
      console.log('🔍 Debug - employeeIdString:', employeeIdString);
      
      const isAssigned = candidateAssignedTo === employeeIdString;
      
      console.log('🔍 Debug - isAssigned:', isAssigned);
      
      if (!isAssigned) {
        console.log('❌ Access denied - user is not assigned to this candidate');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view candidates assigned to you.'
        });
      }
      
      console.log('✅ Access granted - user is assigned to this candidate');
    }

    // Sort notes, bgCheckNotes, attachments, submissions, and interviews by createdAt/uploadedAt in descending order (newest first)
    if (candidate.notes) {
      candidate.notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    if (candidate.bgCheckNotes) {
      candidate.bgCheckNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    if (candidate.attachments) {
      candidate.attachments.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    }
    if (candidate.submissions) {
      candidate.submissions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    if (candidate.interviews) {
      candidate.interviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const candidateData = candidate.toObject();
    console.log('🔍 GET candidate response - offerDetails type:', typeof candidateData.offerDetails);
    console.log('🔍 GET candidate response - offerDetails isArray:', Array.isArray(candidateData.offerDetails));
    console.log('🔍 GET candidate response - offerDetails:', candidateData.offerDetails);
    
    res.json({
      success: true,
      data: candidateData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE - HR or Admin updates candidate profile
router.put('/:id', (req, res, next) => {
  // Allow both admin and hr roles
  if (req.user && (req.user.role === 'hr' || req.user.role === 'admin')) {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Only HR and Admin can update candidates.' });
  }
}, upload.fields([
  { name: 'cvFile', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: Date.now() };

    // Handle file uploads
    if (req.files) {
      if (req.files.cvFile) {
        updateData.cvFile = req.files.cvFile[0].filename;
      }
      if (req.files.profileImage) {
        updateData.profileImage = req.files.profileImage[0].filename;
      }
    }

    // If recruiter is being updated, also set assignedTo to the same value
    if (req.body.recruiter) {
      updateData.assignedTo = req.body.recruiter;
      updateData.assignedBy = req.user._id || req.user.id || req.user.userId;
      updateData.assignedDate = Date.now();
    }

    // Parse JSON fields if they exist
    if (req.body.education) {
      try {
        updateData.education = JSON.parse(req.body.education);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }
    if (req.body.certifications) {
      try {
        updateData.certifications = JSON.parse(req.body.certifications);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }
    if (req.body.experience) {
      try {
        updateData.experience = JSON.parse(req.body.experience);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }
    if (req.body.techStack) {
      try {
        updateData.techStack = JSON.parse(req.body.techStack);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }
    if (req.body.address) {
      try {
        updateData.address = JSON.parse(req.body.address);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }

    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      data: candidate,
      message: 'Candidate updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ASSIGN CANDIDATE - HR or Admin assigns to employee
router.post('/:id/assign', (req, res, next) => {
  // Allow both admin and hr roles
  if (req.user && (req.user.role === 'hr' || req.user.role === 'admin')) {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Only HR and Admin can assign candidates.' });
  }
}, async (req, res) => {
  try {
    const { assignedTo } = req.body;

    // Verify employee exists
    const employee = await Employee.findById(assignedTo);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      {
        assignedTo,
        recruiter: assignedTo, // Also set recruiter to the same value
        assignedBy: req.user.id,
        assignedDate: Date.now(),
        $push: {
          statusHistory: {
            status: 'New',
            changedBy: req.user.id,
            notes: `Assigned to ${employee.firstName} ${employee.lastName}`
          }
        }
      },
      { new: true }
    );

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      data: candidate,
      message: 'Candidate assigned successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE STATUS - Employee updates candidate status
router.put('/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this candidate'
      });
    }

    candidate.status = status;
    candidate.statusHistory.push({
      status,
      changedBy: req.user.id,
      notes: notes || `Status changed to ${status}`
    });

    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Status updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ADD INTERVIEW
router.post('/:id/interviews', async (req, res) => {
  try {
    const { scheduledDate, interviewLevel, interviewer, interviewLink, notes } = req.body;

    if (!scheduledDate || !interviewLevel || !interviewer) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled date, interview level, and interviewer are required'
      });
    }

    // Validate interview date is not in the past
    const selectedDate = new Date(scheduledDate);
    const now = new Date();
    if (selectedDate < now) {
      return res.status(400).json({
        success: false,
        message: 'Interview date cannot be in the past. Please select a future date.'
      });
    }

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate, is the recruiter, or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isRecruiter = candidate.recruiter?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isRecruiter && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to schedule interviews for this candidate'
      });
    }

    // Add new interview
    candidate.interviews.push({
      scheduledDate: new Date(scheduledDate),
      interviewLevel,
      interviewer,
      interviewLink,
      notes,
      createdBy: employee._id
    });

    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Interview scheduled successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE INTERVIEW
router.put('/:id/interviews/:interviewId', async (req, res) => {
  try {
    const { scheduledDate, interviewLevel, interviewer, interviewLink, notes, status } = req.body;

    if (!scheduledDate || !interviewLevel || !interviewer) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled date, interview level, and interviewer are required'
      });
    }

    // Validate interview date is not in the past
    const selectedDate = new Date(scheduledDate);
    const now = new Date();
    if (selectedDate < now) {
      return res.status(400).json({
        success: false,
        message: 'Interview date cannot be in the past. Please select a future date.'
      });
    }

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update interviews for this candidate'
      });
    }

    // Find the interview
    const interview = candidate.interviews.id(req.params.interviewId);
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Update interview
    interview.scheduledDate = new Date(scheduledDate);
    interview.interviewLevel = interviewLevel;
    interview.interviewer = interviewer;
    interview.interviewLink = interviewLink;
    interview.notes = notes;
    if (status) {
      interview.status = status;
    }

    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Interview updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE INTERVIEW
router.delete('/:id/interviews/:interviewId', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Find the interview
    const interview = candidate.interviews.id(req.params.interviewId);
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Check if user is the interview creator or admin/HR
    if (employee && interview.createdBy.toString() !== employee._id.toString() && 
        !['hr', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this interview'
      });
    }

    interview.deleteOne();
    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Interview deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ADD NOTE - Any authorized user can add notes
router.post('/:id/notes', async (req, res) => {
  try {
    const { content } = req.body;

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate, is the recruiter, or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isRecruiter = candidate.recruiter?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isRecruiter && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add notes for this candidate'
      });
    }

    candidate.notes.push({
      content,
      createdBy: employee._id
    });

    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Note added successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE NOTE - Only the note creator or admin/HR can edit
router.put('/:id/notes/:noteId', async (req, res) => {
  try {
    const { content } = req.body;

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    const note = candidate.notes.id(req.params.noteId);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is the note creator or admin/HR
    if (employee && note.createdBy.toString() !== employee._id.toString() && 
        !['hr', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this note'
      });
    }

    note.content = content;
    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Note updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE NOTE - Only the note creator or admin/HR can delete
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    const note = candidate.notes.id(req.params.noteId);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is the note creator or admin/HR
    if (employee && note.createdBy.toString() !== employee._id.toString() && 
        !['hr', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this note'
      });
    }

    note.deleteOne();
    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// SOFT DELETE - Admin/HR can soft delete candidate
router.delete('/:id', (req, res, next) => {
  // Allow both admin and hr roles
  if (req.user && (req.user.role === 'hr' || req.user.role === 'admin')) {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Only HR and Admin can delete candidates.' });
  }
}, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Soft delete - mark as deleted instead of removing from database
    candidate.isDeleted = true;
    candidate.deletedAt = new Date();
    candidate.deletedBy = req.user?.id; // If available from auth middleware
    candidate.deletionReason = req.body.reason || 'Deleted by administrator';
    
    await candidate.save();

    res.json({
      success: true,
      message: 'Candidate soft deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// RESTORE soft deleted candidate (Admin/HR only)
router.patch('/:id/restore', (req, res, next) => {
  // Allow both admin and hr roles
  if (req.user && (req.user.role === 'hr' || req.user.role === 'admin')) {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Only HR and Admin can restore candidates.' });
  }
}, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }
    
    if (!candidate.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Candidate is not deleted'
      });
    }
    
    // Restore the candidate
    candidate.isDeleted = false;
    candidate.deletedAt = undefined;
    candidate.deletedBy = undefined;
    candidate.deletionReason = undefined;
    
    await candidate.save();
    
    res.json({
      success: true,
      message: 'Candidate restored successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// GET soft deleted candidates (Admin/HR only)
router.get('/deleted', (req, res, next) => {
  // Allow both admin and hr roles
  if (req.user && (req.user.role === 'hr' || req.user.role === 'admin')) {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Only HR and Admin can view deleted candidates.' });
  }
}, async (req, res) => {
  try {
    const deletedCandidates = await Candidate.find({ isDeleted: true })
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('recruiter', 'firstName lastName email')
      .populate('deletedBy', 'firstName lastName email')
      .sort({ deletedAt: -1 });
    
    res.json({
      success: true,
      data: deletedCandidates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DOWNLOAD CV FILE
router.get('/:id/download-cv', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    if (!candidate.cvFile) {
      return res.status(404).json({
        success: false,
        message: 'CV file not found for this candidate'
      });
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'candidates', candidate.cvFile);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'CV file not found on server'
      });
    }

    // Get file extension for proper content type
    const fileExtension = path.extname(candidate.cvFile).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (fileExtension === '.pdf') {
      contentType = 'application/pdf';
    } else if (fileExtension === '.doc') {
      contentType = 'application/msword';
    } else if (fileExtension === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    // Create a cleaner filename for download (remove the unique identifier)
    const fileExt = path.extname(candidate.cvFile);
    const fileNameWithoutExt = path.basename(candidate.cvFile, fileExt);
    
    // Handle both old format (timestamp-random-originalname) and new format (originalname-shortid)
    const parts = fileNameWithoutExt.split('-');
    
    let cleanFileName;
    // If it's the old format with timestamp at the beginning (timestamp is 13+ digits)
    if (parts.length >= 3 && /^\d{13,}$/.test(parts[0])) {
        // Old format: timestamp-random-originalname
        // Remove first two parts (timestamp and random number)
        cleanFileName = parts.slice(2).join('-') + fileExt;
    } else {
        // New format: originalname-shortid
        // The last part should be a short numeric identifier (6-9 digits)
        const lastPart = parts[parts.length - 1];
        if (/^\d{6,9}$/.test(lastPart)) {
            // Remove the last part (short unique identifier)
            cleanFileName = parts.slice(0, -1).join('-') + fileExt;
        } else {
            // If the last part doesn't look like a numeric ID, return the original
            cleanFileName = candidate.cvFile;
        }
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    // Handle file stream errors
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming CV file'
        });
      }
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading CV:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error downloading CV file'
      });
    }
  }
});

// UPLOAD ATTACHMENT - Any authorized user can upload attachments
router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate, is the recruiter, or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isRecruiter = candidate.recruiter?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isRecruiter && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload attachments for this candidate'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Create attachment object
    const attachment = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      description: req.body.description || '',
      uploadedBy: employee._id
    };

    candidate.attachments.push(attachment);
    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Attachment uploaded successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE ATTACHMENT - Only the uploader or admin/HR can delete
router.delete('/:id/attachments/:attachmentId', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    const attachment = candidate.attachments.id(req.params.attachmentId);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is the uploader or admin/HR
    if (employee && attachment.uploadedBy.toString() !== employee._id.toString() && 
        !['hr', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this attachment'
      });
    }

    // Delete the file from server
    const filePath = path.join(__dirname, '..', 'uploads', 'candidates', attachment.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove attachment from candidate
    attachment.deleteOne();
    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// DOWNLOAD ATTACHMENT
router.get('/:id/attachments/:attachmentId/download', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    const attachment = candidate.attachments.id(req.params.attachmentId);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'candidates', attachment.fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Attachment file not found on server'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', attachment.fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    // Handle file stream errors
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming attachment file'
        });
      }
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading attachment:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error downloading attachment file'
      });
    }
  }
});

// ==================== BG CHECK NOTES ENDPOINTS ====================

// ADD BG CHECK NOTE - Any authorized user can add BG check notes
router.post('/:id/bg-check-notes', async (req, res) => {
  try {
    const { content } = req.body;

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate, is the recruiter, or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isRecruiter = candidate.recruiter?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isRecruiter && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add BG check notes for this candidate'
      });
    }

    candidate.bgCheckNotes.push({
      content,
      createdBy: employee._id
    });

    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'BG check note added successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE BG CHECK NOTE - Only the note creator or admin/HR can edit
router.put('/:id/bg-check-notes/:noteId', async (req, res) => {
  try {
    const { content } = req.body;

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    const note = candidate.bgCheckNotes.id(req.params.noteId);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'BG check note not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is the note creator or admin/HR
    if (employee && note.createdBy.toString() !== employee._id.toString() && 
        !['hr', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this BG check note'
      });
    }

    note.content = content;
    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'BG check note updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE BG CHECK NOTE - Only the note creator or admin/HR can delete
router.delete('/:id/bg-check-notes/:noteId', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    const note = candidate.bgCheckNotes.id(req.params.noteId);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'BG check note not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is the note creator or admin/HR
    if (employee && note.createdBy.toString() !== employee._id.toString() && 
        !['hr', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this BG check note'
      });
    }

    note.deleteOne();
    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'BG check note deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== OFFER DETAILS ENDPOINTS ====================

// SAVE/UPDATE OFFER DETAILS
router.post('/:id/offer-details', async (req, res) => {
  try {
    const { candidateName, jobTitle, jobLocation, payRate, vendorName, clientName, startDate, status } = req.body;
    console.log('POST offer-details - Received data:', req.body); // Debug log

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate, is the recruiter, or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isRecruiter = candidate.recruiter?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isRecruiter && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to save offer details for this candidate'
      });
    }

    // Add new offer details to the array
    const newOfferDetail = {
      candidateName,
      jobTitle,
      jobLocation,
      payRate,
      vendorName,
      clientName,
      startDate: startDate ? new Date(startDate) : null,
      status: status || 'draft',
      createdBy: employee._id,
      createdAt: new Date(),
      updatedBy: employee._id,
      updatedAt: new Date()
    };

    // Initialize offerDetails array if it doesn't exist
    if (!candidate.offerDetails) {
      candidate.offerDetails = [];
    }

    candidate.offerDetails.push(newOfferDetail);

    console.log('POST offer-details - Saving offerDetails:', candidate.offerDetails); // Debug log
    console.log('POST offer-details - offerDetails type before save:', typeof candidate.offerDetails);
    console.log('POST offer-details - offerDetails isArray before save:', Array.isArray(candidate.offerDetails));
    
    try {
      await candidate.save();
      console.log('POST offer-details - Save successful');
    } catch (saveError) {
      console.error('POST offer-details - Save error:', saveError);
      throw saveError;
    }
    
    console.log('POST offer-details - After save, candidate.offerDetails:', candidate.offerDetails); // Debug log

    res.json({
      success: true,
      data: candidate,
      message: 'Offer details saved successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE OFFER DETAILS
router.put('/:id/offer-details', async (req, res) => {
  try {
    const { candidateName, jobTitle, jobLocation, payRate, vendorName, clientName, startDate, status } = req.body;
    console.log('PUT offer-details - Received data:', req.body); // Debug log

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate, is the recruiter, or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isRecruiter = candidate.recruiter?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isRecruiter && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update offer details for this candidate'
      });
    }

    // Check if offer details exist
    if (!candidate.offerDetails || candidate.offerDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No offer details found to update'
      });
    }

    // For now, update the first offer detail (we'll need to modify this to handle specific IDs)
    // TODO: Add offerDetailId parameter to update specific offer detail
    candidate.offerDetails[0] = {
      ...candidate.offerDetails[0], // Keep existing fields like _id, createdBy, createdAt
      candidateName,
      jobTitle,
      jobLocation,
      payRate,
      vendorName,
      clientName,
      startDate: startDate ? new Date(startDate) : null,
      status: status || candidate.offerDetails[0].status || 'draft',
      updatedBy: employee._id,
      updatedAt: new Date()
    };

    console.log('PUT offer-details - Saving offerDetails:', candidate.offerDetails); // Debug log
    await candidate.save();
    console.log('PUT offer-details - After save, candidate.offerDetails:', candidate.offerDetails); // Debug log

    res.json({
      success: true,
      data: candidate,
      message: 'Offer details updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE OFFER DETAILS
router.delete('/:id/offer-details', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate, is the recruiter, or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isRecruiter = candidate.recruiter?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isRecruiter && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete offer details for this candidate'
      });
    }

    // Check if offer details exist
    if (!candidate.offerDetails || candidate.offerDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No offer details found to delete'
      });
    }

    // Remove all offer details (or we can add specific ID deletion later)
    candidate.offerDetails = [];
    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Offer details deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== SUBMISSION ENDPOINTS ====================

// ADD SUBMISSION
router.post('/:id/submissions', async (req, res) => {
  try {
    const { submissionDate, submissionNumber } = req.body;

    // Validate submission date is not in the future
    const selectedDate = new Date(submissionDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of today to allow today's date
    
    if (selectedDate > today) {
      return res.status(400).json({
        success: false,
        message: 'Submission date cannot be in the future. Please select today\'s date or a past date.'
      });
    }

    // Validate submission number is not negative
    const submissionNumberInt = parseInt(submissionNumber);
    if (submissionNumberInt < 0) {
      return res.status(400).json({
        success: false,
        message: 'Submission number cannot be negative. Please enter a positive number.'
      });
    }

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate, is the recruiter, or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isRecruiter = candidate.recruiter?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isRecruiter && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add submissions for this candidate'
      });
    }

    // Add new submission
    candidate.submissions.push({
      submissionDate: new Date(submissionDate),
      submissionNumber,
      createdBy: employee._id
    });

    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Submission added successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE SUBMISSION
router.put('/:id/submissions/:submissionId', async (req, res) => {
  try {
    const { submissionDate, submissionNumber } = req.body;

    // Validate submission date is not in the future
    const selectedDate = new Date(submissionDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of today to allow today's date
    
    if (selectedDate > today) {
      return res.status(400).json({
        success: false,
        message: 'Submission date cannot be in the future. Please select today\'s date or a past date.'
      });
    }

    // Validate submission number is not negative
    const submissionNumberInt = parseInt(submissionNumber);
    if (submissionNumberInt < 0) {
      return res.status(400).json({
        success: false,
        message: 'Submission number cannot be negative. Please enter a positive number.'
      });
    }

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update submissions for this candidate'
      });
    }

    // Find the submission
    const submission = candidate.submissions.id(req.params.submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Update submission
    submission.submissionDate = new Date(submissionDate);
    submission.submissionNumber = submissionNumber;

    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Submission updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE SUBMISSION
router.delete('/:id/submissions/:submissionId', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Find the submission
    const submission = candidate.submissions.id(req.params.submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Check if user is the submission creator or admin/HR
    if (employee && submission.createdBy.toString() !== employee._id.toString() && 
        !['hr', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this submission'
      });
    }

    submission.deleteOne();
    await candidate.save();

    res.json({
      success: true,
      data: candidate,
      message: 'Submission deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// EXPORT SUBMISSIONS TO EXCEL
router.post('/:id/submissions/export', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id)
      .populate('submissions.createdBy', 'firstName lastName')
      .populate('recruiter', 'firstName lastName')
      .populate('assignedTo', 'firstName lastName');
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Get the current employee directly (since we're now using Employee for auth)
    const employeeId = req.user._id || req.user.id || req.user.userId;
    let employee = await Employee.findById(employeeId);
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile not found. Please contact administrator.'
      });
    }

    // Check if user is assigned to this candidate, is the recruiter, or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isRecruiter = candidate.recruiter?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isRecruiter && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to export submissions for this candidate'
      });
    }

    const { filter, dateRange } = req.body;
    
    console.log('Export request - Filter:', filter, 'DateRange:', dateRange);
    
    // Filter submissions based on the provided filter
    let filteredSubmissions = candidate.submissions;
    
    if (filter && filter !== 'all') {
      const now = new Date();
      const startDate = new Date();
      const endDate = new Date();
      
      switch (filter) {
        case 'last-week':
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'this-month':
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          endDate.setMonth(now.getMonth() + 1);
          endDate.setDate(0);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'last-month':
          startDate.setMonth(now.getMonth() - 1);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          endDate.setDate(0);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'last-6-months':
          startDate.setMonth(now.getMonth() - 6);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'date-range':
          if (dateRange && dateRange.startDate && dateRange.endDate) {
            startDate.setTime(new Date(dateRange.startDate).getTime());
            startDate.setHours(0, 0, 0, 0);
            endDate.setTime(new Date(dateRange.endDate).getTime());
            endDate.setHours(23, 59, 59, 999);
          }
          break;
        default:
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
      }
      
      filteredSubmissions = candidate.submissions.filter(submission => {
        const submissionDate = new Date(submission.submissionDate);
        return submissionDate >= startDate && submissionDate <= endDate;
      });
    }

    // Sort submissions by date (newest first)
    filteredSubmissions.sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate));

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Submissions');

    // Generate filter description for header
    let filterDescription = '';
    const now = new Date();
    
    switch (filter) {
      case 'last-week':
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - 7);
        filterDescription = `Last Week (${lastWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
        break;
      case 'this-month':
        filterDescription = `${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        break;
      case 'last-month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        filterDescription = `${lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        break;
      case 'last-6-months':
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        filterDescription = `Last 6 Months (${sixMonthsAgo.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`;
        break;
      case 'date-range':
        if (dateRange && dateRange.startDate && dateRange.endDate) {
          const startDate = new Date(dateRange.startDate);
          const endDate = new Date(dateRange.endDate);
          filterDescription = `Custom Range (${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
        } else {
          filterDescription = 'All Time';
        }
        break;
      default:
        filterDescription = `${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    }
    
    console.log('Generated filter description:', filterDescription);

    // Add headers first
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Submission Number', key: 'number', width: 20 },
      { header: 'Added By', key: 'addedBy', width: 25 },
      { header: 'Created At', key: 'createdAt', width: 20 }
    ];

    // Set title and filter information directly in cells
    worksheet.getCell('A1').value = `Submissions Report - ${filterDescription}`;
    worksheet.getCell('A2').value = ''; // Empty row for spacing

    // Style the title row
    worksheet.getRow(1).font = { bold: true, size: 11 };
    worksheet.getRow(1).alignment = { horizontal: 'center' };
    
    // Style the header row (now row 3)
    worksheet.getRow(3).font = { bold: true, size: 10 };
    worksheet.getRow(3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows (starting from row 4)
    filteredSubmissions.forEach((submission, index) => {
      const rowNumber = index + 4; // Start from row 4 (after title and empty row)
      worksheet.getCell(`A${rowNumber}`).value = new Date(submission.submissionDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      worksheet.getCell(`B${rowNumber}`).value = submission.submissionNumber;
      worksheet.getCell(`C${rowNumber}`).value = submission.createdBy ? 
        `${submission.createdBy.firstName} ${submission.createdBy.lastName}` : 
        'Unknown User';
      worksheet.getCell(`D${rowNumber}`).value = new Date(submission.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    // Add summary information
    const summaryStartRow = filteredSubmissions.length + 5; // 1 title row + 1 empty row + 1 header row + data rows + 1 empty row
    worksheet.getCell(`A${summaryStartRow}`).value = 'Summary Information';
    worksheet.getCell(`A${summaryStartRow + 1}`).value = 'Total Submissions';
    worksheet.getCell(`B${summaryStartRow + 1}`).value = filteredSubmissions.length;
    worksheet.getCell(`A${summaryStartRow + 2}`).value = 'Total Submission Numbers';
    worksheet.getCell(`B${summaryStartRow + 2}`).value = filteredSubmissions.reduce((sum, s) => sum + parseInt(s.submissionNumber), 0);
    worksheet.getCell(`A${summaryStartRow + 3}`).value = 'Candidate Name';
    worksheet.getCell(`B${summaryStartRow + 3}`).value = `${candidate.firstName} ${candidate.lastName}`;
    worksheet.getCell(`A${summaryStartRow + 4}`).value = 'Export Date';
    worksheet.getCell(`B${summaryStartRow + 4}`).value = new Date().toLocaleDateString('en-US');

    // Style summary rows
    worksheet.getRow(summaryStartRow).font = { bold: true, size: 10 }; // Summary Information title
    worksheet.getRow(summaryStartRow + 1).font = { bold: true, size: 10 };
    worksheet.getRow(summaryStartRow + 2).font = { bold: true, size: 10 };
    worksheet.getRow(summaryStartRow + 3).font = { bold: true, size: 10 };
    worksheet.getRow(summaryStartRow + 4).font = { bold: true, size: 10 };

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="submissions_${candidate.firstName}_${candidate.lastName}_${new Date().toISOString().split('T')[0]}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export submissions'
    });
  }
});

module.exports = router; 