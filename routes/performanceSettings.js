const express = require('express');
const PerformanceSettings = require('../models/PerformanceSettings.js');
const Candidate = require('../models/Candidate.js');
const Employee = require('../models/Employee.js');
const auth = require('../middleware/auth.js');
const role = require('../middleware/role.js');

const router = express.Router();

// GET performance settings
router.get('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    console.log('🔍 GET /performance-settings - User:', req.user);
    
    const settings = await PerformanceSettings.getCurrentSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching performance settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// UPDATE performance settings
router.put('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    console.log('🔍 PUT /performance-settings - User:', req.user);
    
    const {
      submissions,
      interviews,
      jobOffers,
      performanceLevels,
      description
    } = req.body;
    
    let settings = await PerformanceSettings.findOne();
    
    if (!settings) {
      settings = new PerformanceSettings({
        createdBy: req.user._id
      });
    }
    
    // Update submissions thresholds
    if (submissions) {
      if (submissions.low !== undefined) settings.submissions.low = submissions.low;
      if (submissions.average !== undefined) settings.submissions.average = submissions.average;
      if (submissions.high !== undefined) settings.submissions.high = submissions.high;
    }
    
    // Update interviews thresholds
    if (interviews) {
      if (interviews.low !== undefined) settings.interviews.low = interviews.low;
      if (interviews.average !== undefined) settings.interviews.average = interviews.average;
      if (interviews.high !== undefined) settings.interviews.high = interviews.high;
    }
    
    // Update job offers thresholds
    if (jobOffers) {
      if (jobOffers.low !== undefined) settings.jobOffers.low = jobOffers.low;
      if (jobOffers.average !== undefined) settings.jobOffers.average = jobOffers.average;
      if (jobOffers.high !== undefined) settings.jobOffers.high = jobOffers.high;
    }
    
    // Update performance levels
    if (performanceLevels) {
      if (performanceLevels.low) settings.performanceLevels.low = performanceLevels.low;
      if (performanceLevels.average) settings.performanceLevels.average = performanceLevels.average;
      if (performanceLevels.high) settings.performanceLevels.high = performanceLevels.high;
    }
    
    // Update description
    if (description !== undefined) settings.description = description;
    
    // Set createdBy if not set (for initial creation)
    if (!settings.createdBy) {
      settings.createdBy = req.user._id;
    }
    
    settings.updatedBy = req.user._id;
    
    await settings.save();
    
    res.json({
      success: true,
      message: 'Performance settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating performance settings:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// GET employee performance data with calculated performance levels
router.get('/employee-performance', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    console.log('🔍 GET /performance-settings/employee-performance - User:', req.user);
    
    const { employeeId, dateFrom, dateTo } = req.query;
    
    // Get current performance settings
    const settings = await PerformanceSettings.getCurrentSettings();
    
    // Build filter for candidates
    const filter = { isDeleted: { $ne: true } };
    if (employeeId && employeeId !== 'all') {
      filter.assignedTo = employeeId;
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    
    // Aggregate candidate data to get employee performance
    const employeePerformance = await Candidate.aggregate([
      { $match: filter },
      { $group: {
        _id: '$assignedTo',
        totalCandidates: { $sum: 1 },
        submissions: { $sum: { $size: { $ifNull: ['$submissions', []] } } },
        interviews: { $sum: { $size: { $ifNull: ['$interviews', []] } } },
        jobOffers: { $sum: { $size: { $ifNull: ['$offerDetails', []] } } },
        byStatus: {
          $push: {
            status: '$status',
            submissions: { $size: { $ifNull: ['$submissions', []] } },
            interviews: { $size: { $ifNull: ['$interviews', []] } },
            jobOffers: { $size: { $ifNull: ['$offerDetails', []] } }
          }
        }
      }},
      { $lookup: { 
        from: 'employees', 
        localField: '_id', 
        foreignField: '_id', 
        as: 'employee' 
      }},
      { $unwind: '$employee' },
      { $project: {
        employeeId: '$_id',
        employeeName: { $concat: ['$employee.firstName', ' ', '$employee.lastName'] },
        employeeEmail: '$employee.email',
        employeeDesignation: '$employee.designation',
        totalCandidates: 1,
        submissions: 1,
        interviews: 1,
        jobOffers: 1,
        byStatus: 1
      }}
    ]);
    
    // Calculate performance levels for each employee
    const performanceData = employeePerformance.map(emp => {
      const submissionsLevel = settings.calculatePerformanceLevel('submissions', emp.submissions);
      const interviewsLevel = settings.calculatePerformanceLevel('interviews', emp.interviews);
      const jobOffersLevel = settings.calculatePerformanceLevel('jobOffers', emp.jobOffers);
      
      // Calculate overall performance score
      const getScore = (level) => {
        if (level === settings.performanceLevels.high) return 100;
        if (level === settings.performanceLevels.average) return 50;
        return 25; // Low performance
      };
      
      const overallScore = Math.round(
        (getScore(submissionsLevel) + getScore(interviewsLevel) + getScore(jobOffersLevel)) / 3
      );
      
      return {
        ...emp,
        performance: {
          submissions: {
            count: emp.submissions,
            level: submissionsLevel,
            thresholds: settings.submissions
          },
          interviews: {
            count: emp.interviews,
            level: interviewsLevel,
            thresholds: settings.interviews
          },
          jobOffers: {
            count: emp.jobOffers,
            level: jobOffersLevel,
            thresholds: settings.jobOffers
          },
          overall: {
            score: overallScore,
            level: overallScore >= 75 ? settings.performanceLevels.high : 
                   overallScore >= 50 ? settings.performanceLevels.average : 
                   settings.performanceLevels.low
          }
        }
      };
    });
    
    res.json({
      success: true,
      data: {
        settings: settings,
        employeePerformance: performanceData
      }
    });
  } catch (error) {
    console.error('Error fetching employee performance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// GET performance preview with example calculations
router.get('/preview', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    console.log('🔍 GET /performance-settings/preview - User:', req.user);
    
    const settings = await PerformanceSettings.getCurrentSettings();
    
    // Create example calculations
    const examples = {
      submissions: [
        { value: settings.submissions.low - 1, level: settings.calculatePerformanceLevel('submissions', settings.submissions.low - 1) },
        { value: settings.submissions.low, level: settings.calculatePerformanceLevel('submissions', settings.submissions.low) },
        { value: settings.submissions.average, level: settings.calculatePerformanceLevel('submissions', settings.submissions.average) },
        { value: settings.submissions.high, level: settings.calculatePerformanceLevel('submissions', settings.submissions.high) },
        { value: settings.submissions.high + 1, level: settings.calculatePerformanceLevel('submissions', settings.submissions.high + 1) }
      ],
      interviews: [
        { value: settings.interviews.low - 1, level: settings.calculatePerformanceLevel('interviews', settings.interviews.low - 1) },
        { value: settings.interviews.low, level: settings.calculatePerformanceLevel('interviews', settings.interviews.low) },
        { value: settings.interviews.average, level: settings.calculatePerformanceLevel('interviews', settings.interviews.average) },
        { value: settings.interviews.high, level: settings.calculatePerformanceLevel('interviews', settings.interviews.high) },
        { value: settings.interviews.high + 1, level: settings.calculatePerformanceLevel('interviews', settings.interviews.high + 1) }
      ],
      jobOffers: [
        { value: settings.jobOffers.low - 1, level: settings.calculatePerformanceLevel('jobOffers', settings.jobOffers.low - 1) },
        { value: settings.jobOffers.low, level: settings.calculatePerformanceLevel('jobOffers', settings.jobOffers.low) },
        { value: settings.jobOffers.average, level: settings.calculatePerformanceLevel('jobOffers', settings.jobOffers.average) },
        { value: settings.jobOffers.high, level: settings.calculatePerformanceLevel('jobOffers', settings.jobOffers.high) },
        { value: settings.jobOffers.high + 1, level: settings.calculatePerformanceLevel('jobOffers', settings.jobOffers.high + 1) }
      ]
    };
    
    res.json({
      success: true,
      data: {
        settings: settings,
        examples: examples
      }
    });
  } catch (error) {
    console.error('Error generating performance preview:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router;
