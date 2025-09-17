const mongoose = require('mongoose');

const attendanceSettingsSchema = new mongoose.Schema({
  // Whether automatic absence marking is enabled
  autoAbsenceEnabled: {
    type: Boolean,
    default: true
  },
  
  // Time by which employees must check in (in 24-hour format, IST)
  absenceMarkingTime: {
    type: String,
    default: '12:00', // 12:00 PM IST
    validate: {
      validator: function(v) {
        // Validate time format (HH:MM)
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Time must be in HH:MM format (24-hour)'
    }
  },
  
  // Working hours configuration (IST)
  workingHours: {
    startTime: {
      type: String,
      default: '09:00', // 9:00 AM IST
      validate: {
        validator: function(v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Start time must be in HH:MM format (24-hour)'
      }
    },
    endTime: {
      type: String,
      default: '18:00', // 6:00 PM IST
      validate: {
        validator: function(v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'End time must be in HH:MM format (24-hour)'
      }
    }
  },
  
  // Late marking threshold (in minutes after start time)
  lateThresholdMinutes: {
    type: Number,
    default: 15, // 15 minutes
    min: 0,
    max: 480 // 8 hours max
  },
  
  // Half day threshold (in hours)
  halfDayThresholdHours: {
    type: Number,
    default: 4, // 4 hours
    min: 1,
    max: 12
  },
  
  // Auto checkout hours (hours after which employee can check in again)
  autoCheckoutHours: {
    type: Number,
    default: 16, // 16 hours
    min: 1,
    max: 48, // Maximum 48 hours
    description: 'Hours after which employee can check in again after first punch-in'
  },
  
  // Additional notes or description
  description: {
    type: String,
    default: ''
  },
  
  // Created and updated by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one settings record exists
attendanceSettingsSchema.index({}, { unique: true });

// Virtual for formatted absence marking time (12-hour format)
attendanceSettingsSchema.virtual('formattedAbsenceMarkingTime').get(function() {
  if (!this.absenceMarkingTime) return '';
  
  const [hours, minutes] = this.absenceMarkingTime.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  
  return `${displayHour}:${minutes} ${ampm}`;
});

// Virtual for formatted working hours
attendanceSettingsSchema.virtual('formattedWorkingHours').get(function() {
  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };
  
  return {
    startTime: formatTime(this.workingHours?.startTime),
    endTime: formatTime(this.workingHours?.endTime)
  };
});

// Ensure virtuals are included in JSON output
attendanceSettingsSchema.set('toJSON', { virtuals: true });
attendanceSettingsSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AttendanceSettings', attendanceSettingsSchema);
