const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Promotion = require('../models/Promotion.js');
const Employee = require('../models/Employee.js');
const auth = require('../middleware/auth.js');

const router = express.Router();

// Ensure uploads/promotions directory exists
const uploadsDir = 'uploads/promotions';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for promotion letter upload
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
  // For promotion letters, accept PDF, DOC, DOCX files
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed for promotion letters!'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Protect all promotion routes
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

// GET all promotions
router.get('/', async (req, res) => {
  try {
    const promotions = await Promotion.find({ isDeleted: false })
      .populate('employee', 'firstName lastName employeeId email department profileImage')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: promotions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET promotion by ID
router.get('/:id', async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId email department profileImage')
      .populate('approvedBy', 'firstName lastName');

    if (!promotion || promotion.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    res.json({
      success: true,
      data: promotion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// CREATE new promotion
router.post('/', upload.single('promotionLetter'), async (req, res) => {
  try {
    const {
      employeeId,
      fromDesignation,
      toDesignation,
      effectiveDate,
      reason,
      remarks
    } = req.body;

    // Validate required fields
    if (!employeeId || !fromDesignation || !toDesignation || !effectiveDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Create promotion data
    const promotionData = {
      employee: employeeId,
      fromDesignation,
      toDesignation,
      effectiveDate: new Date(effectiveDate),
      reason,
      remarks,
      approvedBy: req.user._id || req.user.id || req.user.userId
    };

    // Add promotion letter if uploaded
    if (req.file) {
      promotionData.promotionLetter = {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size
      };
    }

    const promotion = new Promotion(promotionData);
    await promotion.save();

    // Update employee designation
    await Employee.findByIdAndUpdate(employeeId, {
      designation: toDesignation
    });

    res.status(201).json({
      success: true,
      data: promotion,
      message: 'Promotion created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// UPDATE promotion
router.put('/:id', upload.single('promotionLetter'), async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion || promotion.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    const updateData = { ...req.body };

    // Handle promotion letter upload
    if (req.file) {
      updateData.promotionLetter = {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size
      };
    }

    // Parse date fields
    if (req.body.effectiveDate) {
      updateData.effectiveDate = new Date(req.body.effectiveDate);
    }

    const updatedPromotion = await Promotion.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('employee', 'firstName lastName employeeId email department profileImage')
     .populate('approvedBy', 'firstName lastName');

    res.json({
      success: true,
      data: updatedPromotion,
      message: 'Promotion updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE promotion (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion || promotion.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    promotion.isDeleted = true;
    promotion.deletedAt = new Date();
    promotion.deletedBy = req.user._id || req.user.id || req.user.userId;
    promotion.deletionReason = req.body.reason || 'Deleted by user';

    await promotion.save();

    res.json({
      success: true,
      message: 'Promotion deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// UPLOAD promotion letter for existing promotion
router.post('/:id/upload-letter', upload.single('promotionLetter'), async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion || promotion.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    promotion.promotionLetter = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size
    };

    await promotion.save();

    res.json({
      success: true,
      data: promotion,
      message: 'Promotion letter uploaded successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DOWNLOAD promotion letter
router.get('/:id/download-letter', async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion || promotion.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    if (!promotion.promotionLetter || !promotion.promotionLetter.fileName) {
      return res.status(404).json({
        success: false,
        message: 'Promotion letter not found'
      });
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'promotions', promotion.promotionLetter.fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    res.download(filePath, promotion.promotionLetter.originalName);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
