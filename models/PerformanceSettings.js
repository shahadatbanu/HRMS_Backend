const mongoose = require('mongoose');

const performanceSettingsSchema = new mongoose.Schema({
  // Submissions KPI thresholds
  submissions: {
    low: {
      type: Number,
      default: 10,
      min: 0,
      required: true
    },
    average: {
      type: Number,
      default: 20,
      min: 0,
      required: true
    },
    high: {
      type: Number,
      default: 30,
      min: 0,
      required: true
    }
  },

  // Interviews KPI thresholds
  interviews: {
    low: {
      type: Number,
      default: 5,
      min: 0,
      required: true
    },
    average: {
      type: Number,
      default: 10,
      min: 0,
      required: true
    },
    high: {
      type: Number,
      default: 15,
      min: 0,
      required: true
    }
  },

  // Job Offers KPI thresholds
  jobOffers: {
    low: {
      type: Number,
      default: 2,
      min: 0,
      required: true
    },
    average: {
      type: Number,
      default: 5,
      min: 0,
      required: true
    },
    high: {
      type: Number,
      default: 8,
      min: 0,
      required: true
    }
  },

  // Performance calculation settings
  performanceLevels: {
    low: {
      type: String,
      default: 'Low Performance',
      required: true
    },
    average: {
      type: String,
      default: 'Average Performance',
      required: true
    },
    high: {
      type: String,
      default: 'High Performance',
      required: true
    }
  },

  // Additional settings
  isActive: {
    type: Boolean,
    default: true
  },

  description: {
    type: String,
    default: ''
  },

  // Created and updated by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: false // Allow null for initial creation
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }
}, {
  timestamps: true
});

// Ensure only one settings record exists
performanceSettingsSchema.index({}, { unique: true });

// Validation middleware to ensure thresholds are in ascending order
performanceSettingsSchema.pre('save', function(next) {
  // Validate submissions thresholds
  if (this.submissions.low >= this.submissions.average || 
      this.submissions.average >= this.submissions.high) {
    return next(new Error('Submissions thresholds must be in ascending order: low < average < high'));
  }

  // Validate interviews thresholds
  if (this.interviews.low >= this.interviews.average || 
      this.interviews.average >= this.interviews.high) {
    return next(new Error('Interviews thresholds must be in ascending order: low < average < high'));
  }

  // Validate job offers thresholds
  if (this.jobOffers.low >= this.jobOffers.average || 
      this.jobOffers.average >= this.jobOffers.high) {
    return next(new Error('Job offers thresholds must be in ascending order: low < average < high'));
  }

  next();
});

// Static method to get current settings
performanceSettingsSchema.statics.getCurrentSettings = async function() {
  let settings = await this.findOne();
  
  if (!settings) {
    // Create default settings if none exist
    settings = new this({
      // createdBy will be set when first updated by a user
    });
    await settings.save();
  }
  
  return settings;
};

// Instance method to calculate performance level
performanceSettingsSchema.methods.calculatePerformanceLevel = function(kpiType, value) {
  const thresholds = this[kpiType];
  
  if (value < thresholds.low) {
    return this.performanceLevels.low;
  } else if (value >= thresholds.low && value < thresholds.average) {
    return this.performanceLevels.average;
  } else if (value >= thresholds.high) {
    return this.performanceLevels.high;
  } else {
    return this.performanceLevels.average; // Between average and high
  }
};

module.exports = mongoose.model('PerformanceSettings', performanceSettingsSchema);
