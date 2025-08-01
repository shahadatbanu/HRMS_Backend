import express from 'express';
import Candidate from '../models/Candidate.js';
import Employee from '../models/Employee.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';

const router = express.Router();

// Protect all report routes
router.use(auth);
router.use(role('admin'));

// Dashboard Overview
router.get('/dashboard', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const filter = {};
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Total candidates
    const totalCandidates = await Candidate.countDocuments(filter);
    
    // Status distribution
    const statusDistribution = await Candidate.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Employee workload
    const employeeWorkload = await Candidate.aggregate([
      { $match: { ...filter, assignedTo: { $exists: true, $ne: null } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
      { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'employee' } },
      { $unwind: '$employee' },
      { $project: { 
        employeeName: { $concat: ['$employee.firstName', ' ', '$employee.lastName'] },
        assignedCandidates: '$count'
      }}
    ]);

    // Monthly trends
    const monthlyTrends = await Candidate.aggregate([
      { $match: filter },
      { $group: {
        _id: { 
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Average time to hire (for completed candidates)
    const completedCandidates = await Candidate.find({
      status: { $in: ['Hired'] },
      ...filter
    });

    let avgTimeToHire = 0;
    if (completedCandidates.length > 0) {
      const totalDays = completedCandidates.reduce((sum, candidate) => {
        const created = new Date(candidate.createdAt);
        const completed = new Date(candidate.updatedAt);
        return sum + Math.ceil((completed - created) / (1000 * 60 * 60 * 24));
      }, 0);
      avgTimeToHire = Math.round(totalDays / completedCandidates.length);
    }

    res.json({
      success: true,
      data: {
        totalCandidates,
        statusDistribution,
        employeeWorkload,
        monthlyTrends,
        avgTimeToHire,
        completedCandidates: completedCandidates.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Employee Performance Report
router.get('/employee-performance', async (req, res) => {
  try {
    const { employeeId, dateFrom, dateTo } = req.query;
    
    const filter = {};
    if (employeeId) filter.assignedTo = employeeId;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const performance = await Candidate.aggregate([
      { $match: filter },
      { $group: {
        _id: '$assignedTo',
        totalAssigned: { $sum: 1 },
        byStatus: {
          $push: {
            status: '$status',
            createdAt: '$createdAt',
            updatedAt: '$updatedAt'
          }
        }
      }},
      { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'employee' } },
      { $unwind: '$employee' },
      { $project: {
        employeeName: { $concat: ['$employee.firstName', ' ', '$employee.lastName'] },
        employeeEmail: '$employee.email',
        totalAssigned: 1,
        byStatus: 1
      }}
    ]);

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Candidate Pipeline Report
router.get('/pipeline', async (req, res) => {
  try {
    const { status, experience, techStack, dateFrom, dateTo } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (experience) filter.yearsOfExperience = { $gte: parseInt(experience) };
    if (techStack) filter['techStack.skills'] = { $in: [techStack] };
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const pipeline = await Candidate.find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Calculate pipeline metrics
    const totalInPipeline = pipeline.length;
    const byStatus = pipeline.reduce((acc, candidate) => {
      acc[candidate.status] = (acc[candidate.status] || 0) + 1;
      return acc;
    }, {});

    const avgTimeInStage = pipeline.reduce((acc, candidate) => {
      const stageTime = Math.ceil((new Date() - new Date(candidate.createdAt)) / (1000 * 60 * 60 * 24));
      acc[candidate.status] = (acc[candidate.status] || 0) + stageTime;
      return acc;
    }, {});

    // Calculate averages
    Object.keys(avgTimeInStage).forEach(status => {
      const count = byStatus[status] || 1;
      avgTimeInStage[status] = Math.round(avgTimeInStage[status] / count);
    });

    res.json({
      success: true,
      data: {
        totalInPipeline,
        byStatus,
        avgTimeInStage,
        candidates: pipeline
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Custom Report Builder
router.post('/custom', async (req, res) => {
  try {
    const { 
      filters, 
      groupBy, 
      metrics, 
      dateFrom, 
      dateTo,
      limit = 100 
    } = req.body;

    let filter = {};
    
    // Apply date filters
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Apply custom filters
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null) {
          filter[key] = filters[key];
        }
      });
    }

    let aggregation = [{ $match: filter }];

    // Apply grouping
    if (groupBy) {
      aggregation.push({ $group: { _id: `$${groupBy}`, count: { $sum: 1 } } });
    }

    // Apply limit
    if (limit) {
      aggregation.push({ $limit: parseInt(limit) });
    }

    const results = await Candidate.aggregate(aggregation);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Export Report Data
router.get('/export', async (req, res) => {
  try {
    const { format = 'json', ...filters } = req.query;
    
    const filter = {};
    Object.keys(filters).forEach(key => {
      if (filters[key] && key !== 'format') {
        filter[key] = filters[key];
      }
    });

    const candidates = await Candidate.find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email');

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = candidates.map(candidate => ({
        'Candidate ID': candidate._id,
        'Name': `${candidate.firstName} ${candidate.lastName}`,
        'Email': candidate.email,
        'Phone': candidate.phone,
        'Status': candidate.status,
        'Applied Role': candidate.appliedRole,
        'Experience': candidate.yearsOfExperience,
        'Assigned To': candidate.assignedTo ? `${candidate.assignedTo.firstName} ${candidate.assignedTo.lastName}` : 'Not Assigned',
        'Created Date': candidate.createdAt,
        'Last Updated': candidate.updatedAt
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=candidates-report.csv');
      
      // Convert to CSV string
      const csvString = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).join(','))
      ].join('\n');

      res.send(csvString);
    } else {
      res.json({
        success: true,
        data: candidates
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router; 