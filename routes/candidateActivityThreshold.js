const express = require('express');
const CandidateActivityThreshold = require('../models/CandidateActivityThreshold.js');
const Candidate = require('../models/Candidate.js');
const auth = require('../middleware/auth.js');
const role = require('../middleware/role.js');

const router = express.Router();

// GET candidate activity threshold settings
router.get('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const settings = await CandidateActivityThreshold.getCurrentSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching candidate activity threshold settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// UPDATE candidate activity threshold settings
router.put('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    console.log('🔍 PUT /candidate-activity-threshold - User:', req.user);
    
    const {
      thresholds,
      levelLabels,
      levelColors,
      description
    } = req.body;
    
    let settings = await CandidateActivityThreshold.findOne();
    
    if (!settings) {
      settings = new CandidateActivityThreshold({
        createdBy: req.user._id
      });
    }
    
    // Update settings
    if (thresholds) {
      settings.thresholds = { ...settings.thresholds, ...thresholds };
    }
    
    if (levelLabels) {
      settings.levelLabels = { ...settings.levelLabels, ...levelLabels };
    }
    
    if (levelColors) {
      settings.levelColors = { ...settings.levelColors, ...levelColors };
    }
    
    if (description !== undefined) {
      settings.description = description;
    }
    
    settings.updatedBy = req.user._id;
    
    await settings.save();
    
    res.json({
      success: true,
      message: 'Candidate activity threshold settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating candidate activity threshold settings:', error);
    
    if (error.message.includes('threshold')) {
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

// GET candidate activity preview with current settings
router.get('/preview', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const settings = await CandidateActivityThreshold.getCurrentSettings();
    
    // Get sample candidates with activity scores
    const candidates = await Candidate.aggregate([
      { 
        $match: { 
          isDeleted: { $ne: true },
          status: { $ne: 'Hired' }
        } 
      },
      {
        $addFields: {
          activityScore: {
            $add: [
              { $size: { $ifNull: ['$submissions', []] } },
              { $size: { $ifNull: ['$interviews', []] } },
              { $size: { $ifNull: ['$offerDetails', []] } }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          activityScore: 1
        }
      },
      { $sort: { activityScore: -1 } },
      { $limit: 20 }
    ]);
    
    // Calculate activity levels for each candidate
    const candidatesWithLevels = candidates.map(candidate => {
      const activityLevel = settings.calculateActivityLevel(candidate.activityScore);
      return {
        ...candidate,
        activityLevel
      };
    });
    
    // Get level distribution
    const levelDistribution = settings.getLevelDistribution(candidates);
    
    res.json({
      success: true,
      data: {
        settings,
        candidates: candidatesWithLevels,
        levelDistribution,
        totalCandidates: candidates.length
      }
    });
  } catch (error) {
    console.error('Error fetching candidate activity preview:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET candidate activity leaderboard with current thresholds
router.get('/leaderboard', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const { filter = 'monthly', page = 1, limit = 7 } = req.query;
    const settings = await CandidateActivityThreshold.getCurrentSettings();
    
    // Build date filter for activity calculation based on the selected period
    const now = new Date();
    let activityDateFilter = {};
    
    switch (filter) {
      case 'all':
        // No date filter - calculate activity based on all-time data
        break;
      case 'weekly':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        activityDateFilter = { $gte: weekAgo };
        break;
      case 'monthly':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        activityDateFilter = { $gte: monthAgo };
        break;
      case '3months':
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        activityDateFilter = { $gte: threeMonthsAgo };
        break;
      case '6months':
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        activityDateFilter = { $gte: sixMonthsAgo };
        break;
      default:
        const defaultMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        activityDateFilter = { $gte: defaultMonthAgo };
    }
    
    const baseFilter = { 
      isDeleted: { $ne: true },
      status: { $ne: 'Hired' }
    };
    
    const candidateActivity = await Candidate.aggregate([
      { $match: baseFilter },
      {
        $addFields: {
          submissionsCount: {
            $size: {
              $filter: {
                input: { $ifNull: ['$submissions', []] },
                cond: Object.keys(activityDateFilter).length > 0 ? 
                  { $gte: ['$$this.submissionDate', activityDateFilter.$gte] } : 
                  true
              }
            }
          },
          interviewsCount: {
            $size: {
              $filter: {
                input: { $ifNull: ['$interviews', []] },
                cond: Object.keys(activityDateFilter).length > 0 ? 
                  { $gte: ['$$this.scheduledDate', activityDateFilter.$gte] } : 
                  true
              }
            }
          },
          offersCount: {
            $size: {
              $filter: {
                input: { $ifNull: ['$offerDetails', []] },
                cond: Object.keys(activityDateFilter).length > 0 ? 
                  { $gte: ['$$this.createdAt', activityDateFilter.$gte] } : 
                  true
              }
            }
          },
          activityScore: {
            $add: [
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$submissions', []] },
                    cond: Object.keys(activityDateFilter).length > 0 ? 
                      { $gte: ['$$this.submissionDate', activityDateFilter.$gte] } : 
                      true
                  }
                }
              },
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$interviews', []] },
                    cond: Object.keys(activityDateFilter).length > 0 ? 
                      { $gte: ['$$this.scheduledDate', activityDateFilter.$gte] } : 
                      true
                  }
                }
              },
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$offerDetails', []] },
                    cond: Object.keys(activityDateFilter).length > 0 ? 
                      { $gte: ['$$this.createdAt', activityDateFilter.$gte] } : 
                      true
                  }
                }
              }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          profileImage: 1,
          submissionsCount: 1,
          interviewsCount: 1,
          offersCount: 1,
          activityScore: 1,
          status: 1
        }
      },
      { $sort: { activityScore: -1 } }
    ]);
    
    // Calculate activity levels using current settings
    const leaderboardData = candidateActivity.map((candidate, index) => {
      const activityLevel = settings.calculateActivityLevel(candidate.activityScore);
      
      return {
        rank: index + 1,
        name: `${candidate.firstName} ${candidate.lastName}`,
        profileImage: candidate.profileImage,
        submissions: candidate.submissionsCount,
        interviews: candidate.interviewsCount,
        offers: candidate.offersCount,
        activityScore: candidate.activityScore,
        status: activityLevel.level,
        statusClass: activityLevel.color
      };
    });
    
    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const finalData = leaderboardData.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: finalData,
      total: leaderboardData.length,
      page: parseInt(page),
      limit: parseInt(limit),
      settings: {
        thresholds: settings.thresholds,
        levelLabels: settings.levelLabels
      }
    });
  } catch (error) {
    console.error('Error fetching candidate activity leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch candidate activity leaderboard',
      error: error.message
    });
  }
});

// GET dead and low candidates with current thresholds
router.get('/dead-low', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const { filter = 'monthly', page = 1, limit = 7 } = req.query;
    const settings = await CandidateActivityThreshold.getCurrentSettings();
    
    // Build date filter for activity calculation based on the selected period
    const now = new Date();
    let activityDateFilter = {};
    
    switch (filter) {
      case 'all':
        break;
      case 'weekly':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        activityDateFilter = { $gte: weekAgo };
        break;
      case 'monthly':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        activityDateFilter = { $gte: monthAgo };
        break;
      case '3months':
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        activityDateFilter = { $gte: threeMonthsAgo };
        break;
      case '6months':
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        activityDateFilter = { $gte: sixMonthsAgo };
        break;
      default:
        const defaultMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        activityDateFilter = { $gte: defaultMonthAgo };
    }
    
    const baseFilter = { 
      isDeleted: { $ne: true },
      status: { $ne: 'Hired' }
    };
    
    const candidateActivity = await Candidate.aggregate([
      { $match: baseFilter },
      {
        $addFields: {
          submissionsCount: {
            $size: {
              $filter: {
                input: { $ifNull: ['$submissions', []] },
                cond: Object.keys(activityDateFilter).length > 0 ? 
                  { $gte: ['$$this.submissionDate', activityDateFilter.$gte] } : 
                  true
              }
            }
          },
          interviewsCount: {
            $size: {
              $filter: {
                input: { $ifNull: ['$interviews', []] },
                cond: Object.keys(activityDateFilter).length > 0 ? 
                  { $gte: ['$$this.scheduledDate', activityDateFilter.$gte] } : 
                  true
              }
            }
          },
          offersCount: {
            $size: {
              $filter: {
                input: { $ifNull: ['$offerDetails', []] },
                cond: Object.keys(activityDateFilter).length > 0 ? 
                  { $gte: ['$$this.createdAt', activityDateFilter.$gte] } : 
                  true
              }
            }
          },
          activityScore: {
            $add: [
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$submissions', []] },
                    cond: Object.keys(activityDateFilter).length > 0 ? 
                      { $gte: ['$$this.submissionDate', activityDateFilter.$gte] } : 
                      true
                  }
                }
              },
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$interviews', []] },
                    cond: Object.keys(activityDateFilter).length > 0 ? 
                      { $gte: ['$$this.scheduledDate', activityDateFilter.$gte] } : 
                      true
                  }
                }
              },
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$offerDetails', []] },
                    cond: Object.keys(activityDateFilter).length > 0 ? 
                      { $gte: ['$$this.createdAt', activityDateFilter.$gte] } : 
                      true
                  }
                }
              }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          profileImage: 1,
          submissionsCount: 1,
          interviewsCount: 1,
          offersCount: 1,
          activityScore: 1,
          status: 1
        }
      },
      { $sort: { activityScore: 1 } } // Sort ascending to get lowest activity first
    ]);
    
    // Calculate activity levels using current settings and filter for Dead and Low only
    const deadLowData = candidateActivity
      .map((candidate, index) => {
        const activityLevel = settings.calculateActivityLevel(candidate.activityScore);
        
        return {
          rank: index + 1,
          name: `${candidate.firstName} ${candidate.lastName}`,
          profileImage: candidate.profileImage,
          submissions: candidate.submissionsCount,
          interviews: candidate.interviewsCount,
          offers: candidate.offersCount,
          activityScore: candidate.activityScore,
          status: activityLevel.level,
          statusClass: activityLevel.color
        };
      })
      .filter(candidate => 
        candidate.status === settings.levelLabels.dead || 
        candidate.status === settings.levelLabels.low
      );
    
    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const finalData = deadLowData.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: finalData,
      total: deadLowData.length,
      page: parseInt(page),
      limit: parseInt(limit),
      settings: {
        thresholds: settings.thresholds,
        levelLabels: settings.levelLabels
      }
    });
  } catch (error) {
    console.error('Error fetching dead and low candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dead and low candidates',
      error: error.message
    });
  }
});

module.exports = router;
