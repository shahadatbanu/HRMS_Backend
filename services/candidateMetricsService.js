const Candidate = require('../models/Candidate');
const Employee = require('../models/Employee');

class CandidateMetricsService {
  /**
   * Calculate total candidates count
   * @param {Object} filter - Additional filters to apply
   * @returns {Promise<number>} Total count of candidates
   */
  static async getTotalCandidates(filter = {}) {
    const baseFilter = { isDeleted: { $ne: true }, ...filter };
    return await Candidate.countDocuments(baseFilter);
  }

  /**
   * Calculate active candidates (last 30 days)
   * A candidate is considered active if they have any activity in the last 30 days
   * @param {Object} filter - Additional filters to apply
   * @returns {Promise<number>} Count of active candidates
   */
  static async getActiveCandidates(filter = {}) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const baseFilter = { isDeleted: { $ne: true }, ...filter };
    
    // Find candidates with activity in the last 30 days
    const activeCandidates = await Candidate.aggregate([
      { $match: baseFilter },
      {
        $addFields: {
          hasRecentActivity: {
            $or: [
              // Check submissions
              {
                $anyElementTrue: {
                  $map: {
                    input: "$submissions",
                    as: "submission",
                    in: { $gte: ["$$submission.submissionDate", thirtyDaysAgo] }
                  }
                }
              },
              // Check interviews
              {
                $anyElementTrue: {
                  $map: {
                    input: "$interviews",
                    as: "interview",
                    in: { $gte: ["$$interview.scheduledDate", thirtyDaysAgo] }
                  }
                }
              },
              // Check offer details
              {
                $anyElementTrue: {
                  $map: {
                    input: "$offerDetails",
                    as: "offer",
                    in: { $gte: ["$$offer.createdAt", thirtyDaysAgo] }
                  }
                }
              },
              // Check notes
              {
                $anyElementTrue: {
                  $map: {
                    input: "$notes",
                    as: "note",
                    in: { $gte: ["$$note.createdAt", thirtyDaysAgo] }
                  }
                }
              },
              // Check attachments
              {
                $anyElementTrue: {
                  $map: {
                    input: "$attachments",
                    as: "attachment",
                    in: { $gte: ["$$attachment.uploadedAt", thirtyDaysAgo] }
                  }
                }
              }
            ]
          }
        }
      },
      { $match: { hasRecentActivity: true } },
      { $count: "activeCount" }
    ]);

    return activeCandidates.length > 0 ? activeCandidates[0].activeCount : 0;
  }

  /**
   * Calculate inactive candidates
   * Formula = Total Candidates - Active Candidates
   * @param {Object} filter - Additional filters to apply
   * @returns {Promise<number>} Count of inactive candidates
   */
  static async getInactiveCandidates(filter = {}) {
    const totalCandidates = await this.getTotalCandidates(filter);
    const activeCandidates = await this.getActiveCandidates(filter);
    return totalCandidates - activeCandidates;
  }

  /**
   * Calculate average time in pipeline for candidates with final status
   * @param {Object} filter - Additional filters to apply
   * @returns {Promise<number>} Average days in pipeline
   */
  static async getAverageTimeInPipeline(filter = {}) {
    const baseFilter = { 
      isDeleted: { $ne: true }, 
      status: { $in: ['Hired', 'Rejected'] },
      ...filter 
    };

    const candidates = await Candidate.find(baseFilter)
      .select('createdAt statusHistory status updatedAt');

    if (candidates.length === 0) {
      return 0;
    }

    let totalDays = 0;
    let validCandidates = 0;

    candidates.forEach(candidate => {
      // Find when status changed to final status
      const finalStatusHistory = candidate.statusHistory.find(s => 
        s.status === 'Hired' || s.status === 'Rejected'
      );
      
      const finalDate = finalStatusHistory ? finalStatusHistory.changedAt : candidate.updatedAt;
      const daysDiff = Math.ceil((finalDate - candidate.createdAt) / (1000 * 60 * 60 * 24));
      
      if (daysDiff >= 0) {
        totalDays += daysDiff;
        validCandidates++;
      }
    });

    return validCandidates > 0 ? Math.round((totalDays / validCandidates) * 10) / 10 : 0;
  }

  /**
   * Calculate conversion rate (% Hired)
   * Formula = (Hired ÷ (Hired + Rejected)) × 100
   * @param {Object} filter - Additional filters to apply
   * @returns {Promise<number>} Conversion rate percentage
   */
  static async getConversionRate(filter = {}) {
    const baseFilter = { 
      isDeleted: { $ne: true }, 
      status: { $in: ['Hired', 'Rejected'] },
      ...filter 
    };

    const [hiredCount, rejectedCount] = await Promise.all([
      Candidate.countDocuments({ ...baseFilter, status: 'Hired' }),
      Candidate.countDocuments({ ...baseFilter, status: 'Rejected' })
    ]);

    const totalFinalStatus = hiredCount + rejectedCount;
    return totalFinalStatus > 0 ? Math.round((hiredCount / totalFinalStatus) * 100 * 10) / 10 : 0;
  }

  /**
   * Calculate top recruiter based on activity in last 30 days
   * @param {Object} filter - Additional filters to apply
   * @returns {Promise<Object>} Top recruiter with activity details
   */
  static async getTopRecruiter(filter = {}) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const baseFilter = { isDeleted: { $ne: true }, ...filter };

    // Get recruiter activity scores
    const recruiterActivity = await Candidate.aggregate([
      { $match: baseFilter },
      { $unwind: { path: "$assignedTo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'employees',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'recruiter'
        }
      },
      { $unwind: { path: "$recruiter", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          // Count submissions in last 30 days
          recentSubmissions: {
            $size: {
              $filter: {
                input: "$submissions",
                cond: { $gte: ["$$this.submissionDate", thirtyDaysAgo] }
              }
            }
          },
          // Count interviews in last 30 days
          recentInterviews: {
            $size: {
              $filter: {
                input: "$interviews",
                cond: { $gte: ["$$this.scheduledDate", thirtyDaysAgo] }
              }
            }
          },
          // Count offers in last 30 days
          recentOffers: {
            $size: {
              $filter: {
                input: "$offerDetails",
                cond: { $gte: ["$$this.createdAt", thirtyDaysAgo] }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: "$assignedTo",
          recruiterName: { $first: { $concat: ["$recruiter.firstName", " ", "$recruiter.lastName"] } },
          totalSubmissions: { $sum: "$recentSubmissions" },
          totalInterviews: { $sum: "$recentInterviews" },
          totalOffers: { $sum: "$recentOffers" },
          totalCandidates: { $sum: 1 }
        }
      },
      {
        $addFields: {
          recruiterScore: { $add: ["$totalSubmissions", "$totalInterviews", "$totalOffers"] }
        }
      },
      { $sort: { recruiterScore: -1 } },
      { $limit: 1 }
    ]);

    if (recruiterActivity.length === 0) {
      return {
        name: 'N/A',
        score: 0,
        totalCandidates: 0,
        totalSubmissions: 0,
        totalInterviews: 0,
        totalOffers: 0,
        conversionRate: 0
      };
    }

    const topRecruiter = recruiterActivity[0];

    // Calculate conversion rate for this recruiter
    const recruiterFilter = { 
      ...baseFilter, 
      assignedTo: topRecruiter._id,
      status: { $in: ['Hired', 'Rejected'] }
    };
    
    const [hiredCount, rejectedCount] = await Promise.all([
      Candidate.countDocuments({ ...recruiterFilter, status: 'Hired' }),
      Candidate.countDocuments({ ...recruiterFilter, status: 'Rejected' })
    ]);

    const totalFinalStatus = hiredCount + rejectedCount;
    const conversionRate = totalFinalStatus > 0 ? Math.round((hiredCount / totalFinalStatus) * 100 * 10) / 10 : 0;

    return {
      name: topRecruiter.recruiterName || 'Unknown',
      score: topRecruiter.recruiterScore,
      totalCandidates: topRecruiter.totalCandidates,
      totalSubmissions: topRecruiter.totalSubmissions,
      totalInterviews: topRecruiter.totalInterviews,
      totalOffers: topRecruiter.totalOffers,
      conversionRate: conversionRate
    };
  }

  /**
   * Get comprehensive dashboard metrics
   * @param {Object} options - Options for filtering and date ranges
   * @returns {Promise<Object>} Complete dashboard metrics
   */
  static async getDashboardMetrics(options = {}) {
    const { dateFrom, dateTo, ...additionalFilter } = options;
    
    // Build date filter
    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo);
    }

    const filter = { ...additionalFilter, ...dateFilter };

    // Calculate all metrics in parallel
    const [
      totalCandidates,
      activeCandidates,
      inactiveCandidates,
      avgTimeInPipeline,
      conversionRate,
      topRecruiter
    ] = await Promise.all([
      this.getTotalCandidates(filter),
      this.getActiveCandidates(filter),
      this.getInactiveCandidates(filter),
      this.getAverageTimeInPipeline(filter),
      this.getConversionRate(filter),
      this.getTopRecruiter(filter)
    ]);

    // Calculate percentage changes (simplified for now)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const previousFilter = {
      ...filter,
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    };

    const [
      previousTotalCandidates,
      previousActiveCandidates,
      previousInactiveCandidates,
      previousAvgTimeInPipeline,
      previousConversionRate
    ] = await Promise.all([
      this.getTotalCandidates(previousFilter),
      this.getActiveCandidates(previousFilter),
      this.getInactiveCandidates(previousFilter),
      this.getAverageTimeInPipeline(previousFilter),
      this.getConversionRate(previousFilter)
    ]);

    // Helper function to calculate percentage change
    const calculateChange = (current, previous) => {
      if (previous === 0) return 0;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };

    return {
      totalCandidates: {
        count: totalCandidates,
        change: calculateChange(totalCandidates, previousTotalCandidates),
        changeType: totalCandidates >= previousTotalCandidates ? 'increase' : 'decrease'
      },
      activeCandidates: {
        count: activeCandidates,
        change: calculateChange(activeCandidates, previousActiveCandidates),
        changeType: activeCandidates >= previousActiveCandidates ? 'increase' : 'decrease'
      },
      inactiveCandidates: {
        count: inactiveCandidates,
        change: calculateChange(inactiveCandidates, previousInactiveCandidates),
        changeType: inactiveCandidates >= previousInactiveCandidates ? 'increase' : 'decrease'
      },
      avgPipelineTime: {
        days: avgTimeInPipeline,
        change: calculateChange(avgTimeInPipeline, previousAvgTimeInPipeline),
        changeType: avgTimeInPipeline >= previousAvgTimeInPipeline ? 'increase' : 'decrease'
      },
      conversionRate: {
        percentage: conversionRate,
        change: calculateChange(conversionRate, previousConversionRate),
        changeType: conversionRate >= previousConversionRate ? 'increase' : 'decrease'
      },
      topRecruiter: {
        name: topRecruiter.name,
        conversionRate: topRecruiter.conversionRate,
        score: topRecruiter.score,
        totalCandidates: topRecruiter.totalCandidates,
        totalSubmissions: topRecruiter.totalSubmissions,
        totalInterviews: topRecruiter.totalInterviews,
        totalOffers: topRecruiter.totalOffers
      }
    };
  }
}

module.exports = CandidateMetricsService;
