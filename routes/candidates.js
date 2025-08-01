import express from 'express';
import multer from 'multer';
import Candidate from '../models/Candidate.js';
import Counter from '../models/Counter.js';
import Employee from '../models/Employee.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// ES module directory setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Status filter
    if (status) filter.status = status;

    // Assignment filter
    if (assignedTo) filter.assignedTo = assignedTo;

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

    const candidates = await Candidate.find(filter)
      .populate('assignedTo', 'firstName lastName email profileImage')
      .populate('assignedBy', 'firstName lastName email profileImage')
      .populate('recruiter', 'firstName lastName email profileImage designation')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Candidate.countDocuments(filter);

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
    const candidate = await Candidate.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email profileImage')
      .populate('assignedBy', 'firstName lastName email profileImage')
      .populate('recruiter', 'firstName lastName email profileImage designation')
      .populate('notes.createdBy', 'firstName lastName profileImage email designation')
      .populate('attachments.uploadedBy', 'firstName lastName profileImage email designation');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      data: candidate
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

    // Find the Employee record associated with the current user
    const userId = req.user.id || req.user.userId;
    let employee = await Employee.findOne({ userId: userId });
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile required for updating status. Please contact administrator to create your employee profile.'
      });
    }

    // Check if user is assigned to this candidate, is the recruiter, or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isRecruiter = candidate.recruiter?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isRecruiter && !isHRorAdmin) {
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

// ADD INTERVIEW - Employee adds interview details
router.post('/:id/interviews', async (req, res) => {
  try {
    const { scheduledDate, interviewer, notes } = req.body;

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Find the Employee record associated with the current user
    const userId = req.user.id || req.user.userId;
    let employee = await Employee.findOne({ userId: userId });
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile required for adding interviews. Please contact administrator to create your employee profile.'
      });
    }

    // Check if user is assigned to this candidate, is the recruiter, or is HR/Admin
    const isAssigned = candidate.assignedTo?.toString() === employee._id.toString();
    const isRecruiter = candidate.recruiter?.toString() === employee._id.toString();
    const isHRorAdmin = ['hr', 'admin'].includes(req.user.role);
    
    if (!isAssigned && !isRecruiter && !isHRorAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add interview for this candidate'
      });
    }

    candidate.interviews.push({
      scheduledDate: new Date(scheduledDate),
      interviewer,
      notes,
      status: 'Scheduled'
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

    // Find the Employee record associated with the current user
    const userId = req.user.id || req.user.userId;
    let employee = await Employee.findOne({ userId: userId });
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile required for adding notes. Please contact administrator to create your employee profile.'
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

    // Find the Employee record associated with the current user
    const userId = req.user.id || req.user.userId;
    let employee = await Employee.findOne({ userId: userId });
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile required for editing notes. Please contact administrator to create your employee profile.'
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

    // Find the Employee record associated with the current user
    const userId = req.user.id || req.user.userId;
    let employee = await Employee.findOne({ userId: userId });
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile required for deleting notes. Please contact administrator to create your employee profile.'
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

// DELETE - Admin/HR can delete candidate
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

    // Delete uploaded files if they exist
    if (candidate.cvFile) {
      const cvFilePath = path.join(__dirname, '..', 'uploads', 'candidates', candidate.cvFile);
      if (fs.existsSync(cvFilePath)) {
        fs.unlinkSync(cvFilePath);
      }
    }

    if (candidate.profileImage) {
      const profileImagePath = path.join(__dirname, '..', 'uploads', 'candidates', candidate.profileImage);
      if (fs.existsSync(profileImagePath)) {
        fs.unlinkSync(profileImagePath);
      }
    }

    // Delete attachments if they exist
    if (candidate.attachments && candidate.attachments.length > 0) {
      for (const attachment of candidate.attachments) {
        const attachmentPath = path.join(__dirname, '..', 'uploads', 'candidates', attachment.fileName);
        if (fs.existsSync(attachmentPath)) {
          fs.unlinkSync(attachmentPath);
        }
      }
    }

    // Delete the candidate from database
    await Candidate.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Candidate deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
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

    // Find the Employee record associated with the current user
    const userId = req.user.id || req.user.userId;
    let employee = await Employee.findOne({ userId: userId });
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile required for uploading attachments. Please contact administrator to create your employee profile.'
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

    // Find the Employee record associated with the current user
    const userId = req.user.id || req.user.userId;
    let employee = await Employee.findOne({ userId: userId });
    
    // If no employee profile found, return error
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee profile required for deleting attachments. Please contact administrator to create your employee profile.'
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

export default router; 