const Activity = require('../models/Activity');
const Employee = require('../models/Employee');

class ActivityService {
  // Log a new activity
  static async logActivity(userId, action, entityType, entityId, entityName, description, details = {}) {
    try {
      const activity = new Activity({
        user: userId,
        action,
        entityType,
        entityId,
        entityName,
        description,
        details
      });
      
      await activity.save();
      return activity;
    } catch (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  }

  // Get recent activities for dashboard
  static async getRecentActivities(limit = 10) {
    try {
      const activities = await Activity.find()
        .populate('user', 'firstName lastName profileImage')
        .sort({ timestamp: -1 })
        .limit(limit);
      
      return activities;
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      throw error;
    }
  }

  // Get activities by user
  static async getActivitiesByUser(userId, limit = 20) {
    try {
      const activities = await Activity.find({ user: userId })
        .populate('user', 'firstName lastName profileImage')
        .sort({ timestamp: -1 })
        .limit(limit);
      
      return activities;
    } catch (error) {
      console.error('Error fetching user activities:', error);
      throw error;
    }
  }

  // Get activities by entity
  static async getActivitiesByEntity(entityType, entityId, limit = 20) {
    try {
      const activities = await Activity.find({ 
        entityType, 
        entityId 
      })
        .populate('user', 'firstName lastName profileImage')
        .sort({ timestamp: -1 })
        .limit(limit);
      
      return activities;
    } catch (error) {
      console.error('Error fetching entity activities:', error);
      throw error;
    }
  }

  // Helper methods for common activities
  static async logEmployeeAdded(userId, employeeId, employeeName) {
    return this.logActivity(
      userId,
      'employee_added',
      'employee',
      employeeId,
      employeeName,
      `Added new employee ${employeeName}`
    );
  }

  static async logEmployeeUpdated(userId, employeeId, employeeName) {
    return this.logActivity(
      userId,
      'employee_updated',
      'employee',
      employeeId,
      employeeName,
      `Updated employee ${employeeName}`
    );
  }

  static async logCandidateAdded(userId, candidateId, candidateName) {
    return this.logActivity(
      userId,
      'candidate_added',
      'candidate',
      candidateId,
      candidateName,
      `Added new candidate ${candidateName}`
    );
  }

  static async logCandidateUpdated(userId, candidateId, candidateName) {
    return this.logActivity(
      userId,
      'candidate_updated',
      'candidate',
      candidateId,
      candidateName,
      `Updated candidate ${candidateName}`
    );
  }

  static async logCandidateAssigned(userId, candidateId, candidateName, assignedToName) {
    return this.logActivity(
      userId,
      'candidate_assigned',
      'candidate',
      candidateId,
      candidateName,
      `Assigned candidate ${candidateName} to ${assignedToName}`
    );
  }

  static async logInterviewScheduled(userId, interviewId, candidateName, scheduledDate) {
    return this.logActivity(
      userId,
      'interview_scheduled',
      'interview',
      interviewId,
      candidateName,
      `Scheduled interview for ${candidateName} on ${new Date(scheduledDate).toLocaleDateString()}`
    );
  }

  static async logInterviewUpdated(userId, interviewId, candidateName, interviewLevel) {
    return this.logActivity(
      userId,
      'interview_updated',
      'interview',
      interviewId,
      candidateName,
      `Updated ${interviewLevel} interview for ${candidateName}`
    );
  }

  static async logInterviewStageChanged(userId, interviewId, candidateName, oldStage, newStage) {
    return this.logActivity(
      userId,
      'interview_stage_changed',
      'interview',
      interviewId,
      candidateName,
      `Changed interview stage for ${candidateName} from ${oldStage} to ${newStage}`
    );
  }

  static async logNotesAdded(userId, entityId, entityName, entityType) {
    return this.logActivity(
      userId,
      'notes_added',
      entityType,
      entityId,
      entityName,
      `Added notes to ${entityName}`
    );
  }

  static async logNotesUpdated(userId, entityId, entityName, entityType) {
    return this.logActivity(
      userId,
      'notes_updated',
      entityType,
      entityId,
      entityName,
      `Updated notes for ${entityName}`
    );
  }

  static async logAttachmentAdded(userId, entityId, entityName, entityType, fileName) {
    return this.logActivity(
      userId,
      'attachment_added',
      entityType,
      entityId,
      entityName,
      `Added attachment "${fileName}" to ${entityName}`
    );
  }

  static async logLeaveRequested(userId, leaveId, employeeName) {
    return this.logActivity(
      userId,
      'leave_requested',
      'leave',
      leaveId,
      employeeName,
      `Requested leave for ${employeeName}`
    );
  }

  static async logLeaveApproved(userId, leaveId, employeeName) {
    return this.logActivity(
      userId,
      'leave_approved',
      'leave',
      leaveId,
      employeeName,
      `Approved leave for ${employeeName}`
    );
  }

  static async logLeaveRejected(userId, leaveId, employeeName) {
    return this.logActivity(
      userId,
      'leave_rejected',
      'leave',
      leaveId,
      employeeName,
      `Rejected leave for ${employeeName}`
    );
  }

  static async logAttendanceMarked(userId, attendanceId, employeeName, action) {
    const actionText = action === 'checkout' ? 'checked out' : `marked attendance as ${action}`;
    return this.logActivity(
      userId,
      'attendance_marked',
      'attendance',
      attendanceId,
      employeeName,
      `${actionText} for ${employeeName}`
    );
  }

  static async logTodoCreated(userId, todoId, todoTitle) {
    return this.logActivity(
      userId,
      'todo_created',
      'todo',
      todoId,
      todoTitle,
      `Created todo: ${todoTitle}`
    );
  }

  static async logTodoCompleted(userId, todoId, todoTitle) {
    return this.logActivity(
      userId,
      'todo_completed',
      'todo',
      todoId,
      todoTitle,
      `Completed todo: ${todoTitle}`
    );
  }

  static async logOfferDetailsUpdated(userId, candidateId, candidateName) {
    return this.logActivity(
      userId,
      'offer_details_updated',
      'candidate',
      candidateId,
      candidateName,
      `Updated offer details for ${candidateName}`
    );
  }

  static async logSubmissionUpdated(userId, candidateId, candidateName, submissionNumber) {
    return this.logActivity(
      userId,
      'submission_updated',
      'candidate',
      candidateId,
      candidateName,
      `Updated submission #${submissionNumber} for ${candidateName}`
    );
  }

  static async logSubmissionAdded(userId, candidateId, candidateName, submissionNumber) {
    return this.logActivity(
      userId,
      'submission_added',
      'candidate',
      candidateId,
      candidateName,
      `Added submission #${submissionNumber} for ${candidateName}`
    );
  }

  static async logOfferDetailsAdded(userId, candidateId, candidateName) {
    return this.logActivity(
      userId,
      'offer_details_added',
      'candidate',
      candidateId,
      candidateName,
      `Added offer details for ${candidateName}`
    );
  }

  static async logBgCheckNoteAdded(userId, candidateId, candidateName) {
    return this.logActivity(
      userId,
      'bg_check_note_added',
      'candidate',
      candidateId,
      candidateName,
      `Added background check note for ${candidateName}`
    );
  }

  static async logBgCheckNoteUpdated(userId, candidateId, candidateName) {
    return this.logActivity(
      userId,
      'bg_check_note_updated',
      'candidate',
      candidateId,
      candidateName,
      `Updated background check note for ${candidateName}`
    );
  }

  // Get all activities with pagination and filtering
  static async getAllActivities(page = 1, limit = 20, filter = 'all') {
    try {
      const skip = (page - 1) * limit;
      
      // Build filter query
      let filterQuery = {};
      if (filter !== 'all') {
        filterQuery.entityType = filter;
      }
      
      // Get total count
      const total = await Activity.countDocuments(filterQuery);
      
      // Get activities with pagination
      const activities = await Activity.find(filterQuery)
        .populate('user', 'firstName lastName profileImage')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);
      
      return {
        activities,
        total,
        page,
        limit
      };
    } catch (error) {
      console.error('Error fetching all activities:', error);
      throw error;
    }
  }

  // Delete all activities
  static async deleteAllActivities() {
    try {
      const result = await Activity.deleteMany({});
      
      return {
        success: true,
        deletedCount: result.deletedCount,
        message: `Successfully deleted ${result.deletedCount} activities`
      };
    } catch (error) {
      console.error('Error deleting all activities:', error);
      throw error;
    }
  }
}

module.exports = ActivityService;
