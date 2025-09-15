const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  checkIn: {
    time: {
      type: Date,
      required: function() {
        // Only required if status is not 'Absent'
        return this.status !== 'Absent';
      }
    },
    location: {
      type: String,
      default: ''
    },
    locationName: {
      type: String,
      default: ''
    },
    geolocation: {
      latitude: {
        type: Number,
        default: null
      },
      longitude: {
        type: Number,
        default: null
      }
    }
  },
  checkOut: {
    time: {
      type: Date
    },
    location: {
      type: String,
      default: ''
    },
    locationName: {
      type: String,
      default: ''
    },
    geolocation: {
      latitude: {
        type: Number,
        default: null
      },
      longitude: {
        type: Number,
        default: null
      }
    }
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Late', 'Half Day', 'On Leave'],
    default: 'Present'
  },
  breaks: [{
    startTime: {
      type: Date
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number, // in minutes
      default: 0
    }
  }],
  totalBreakTime: {
    type: Number, // in minutes
    default: 0
  },
  lateMinutes: {
    type: Number,
    default: 0
  },
  overtimeMinutes: {
    type: Number,
    default: 0
  },
  productionHours: {
    type: Number, // in hours
    default: 0
  },
  totalWorkingHours: {
    type: Number, // in hours
    default: 0
  },
  notes: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
attendanceSchema.index({ employeeId: 1, date: 1 });
attendanceSchema.index({ date: 1 });

// Virtual for formatted date
attendanceSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
});

// Virtual for formatted check-in time
attendanceSchema.virtual('formattedCheckIn').get(function() {
  if (this.checkIn && this.checkIn.time) {
    return this.checkIn.time.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  return '';
});

// Virtual for formatted check-out time
attendanceSchema.virtual('formattedCheckOut').get(function() {
  if (this.checkOut && this.checkOut.time) {
    return this.checkOut.time.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  return '';
});

// Virtual for formatted break time
attendanceSchema.virtual('formattedBreakTime').get(function() {
  if (this.totalBreakTime > 0) {
    const hours = Math.floor(this.totalBreakTime / 60);
    const minutes = this.totalBreakTime % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} Min`;
  }
  return '-';
});

// Virtual for formatted late time
attendanceSchema.virtual('formattedLateTime').get(function() {
  if (this.lateMinutes > 0) {
    return `${this.lateMinutes} Min`;
  }
  return '-';
});

// Virtual for formatted overtime
attendanceSchema.virtual('formattedOvertime').get(function() {
  if (this.overtimeMinutes > 0) {
    return `${this.overtimeMinutes} Min`;
  }
  return '-';
});

// Virtual for formatted production hours
attendanceSchema.virtual('formattedProductionHours').get(function() {
  if (this.productionHours > 0) {
    return `${this.productionHours.toFixed(2)} Hrs`;
  }
  return '0.00 Hrs';
});

// Ensure virtuals are included in JSON output
attendanceSchema.set('toJSON', { virtuals: true });
attendanceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Attendance', attendanceSchema); 