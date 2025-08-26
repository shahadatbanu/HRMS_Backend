const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'employee_added',
      'employee_updated',
      'candidate_added',
      'candidate_updated',
      'interview_scheduled',
      'interview_updated',
      'interview_stage_changed',
      'notes_added',
      'attachment_added',
      'leave_requested',
      'leave_approved',
      'leave_rejected',
      'attendance_marked',
      'todo_created',
      'todo_completed',
      'project_created',
      'project_updated'
    ]
  },
  entityType: {
    type: String,
    required: true,
    enum: ['employee', 'candidate', 'interview', 'leave', 'attendance', 'todo', 'project']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  entityName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
activitySchema.index({ timestamp: -1 });
activitySchema.index({ user: 1, timestamp: -1 });
activitySchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('Activity', activitySchema);
