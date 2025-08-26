const express = require('express');
const router = express.Router();
const ActivityService = require('../services/activityService');
const auth = require('../middleware/auth');

// GET recent activities for dashboard
router.get('/recent', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const activities = await ActivityService.getRecentActivities(limit);
    
    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities',
      error: error.message
    });
  }
});

// GET activities by user
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const activities = await ActivityService.getActivitiesByUser(userId, limit);
    
    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching user activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activities',
      error: error.message
    });
  }
});

// GET activities by entity
router.get('/entity/:entityType/:entityId', auth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const activities = await ActivityService.getActivitiesByEntity(entityType, entityId, limit);
    
    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching entity activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch entity activities',
      error: error.message
    });
  }
});

// GET all activities with pagination and filtering
router.get('/all', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = req.query.filter || 'all';
    
    const result = await ActivityService.getAllActivities(page, limit, filter);
    
    res.json({
      success: true,
      data: result.activities,
      total: result.total,
      page: page,
      limit: limit
    });
  } catch (error) {
    console.error('Error fetching all activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all activities',
      error: error.message
    });
  }
});

// DELETE all activities
router.delete('/delete-all', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete all activities'
      });
    }

    const result = await ActivityService.deleteAllActivities();
    
    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} activities`
    });
  } catch (error) {
    console.error('Error deleting all activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete all activities',
      error: error.message
    });
  }
});

module.exports = router;
