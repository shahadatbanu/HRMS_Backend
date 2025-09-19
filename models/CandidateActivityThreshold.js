const mongoose = require('mongoose');

const candidateActivityThresholdSchema = new mongoose.Schema({
  // Activity score thresholds for different levels
  thresholds: {
    low: {
      type: Number,
      default: 1,
      min: 0,
      required: true
    },
    moderate: {
      type: Number,
      default: 5,
      min: 0,
      required: true
    },
    active: {
      type: Number,
      default: 10,
      min: 0,
      required: true
    },
    superActive: {
      type: Number,
      default: 20,
      min: 0,
      required: true
    }
  },

  // Activity level labels
  levelLabels: {
    dead: {
      type: String,
      default: 'Dead',
      required: true
    },
    low: {
      type: String,
      default: 'Low',
      required: true
    },
    moderate: {
      type: String,
      default: 'Moderate',
      required: true
    },
    active: {
      type: String,
      default: 'Active',
      required: true
    },
    superActive: {
      type: String,
      default: 'Super Active',
      required: true
    }
  },

  // Activity level colors for UI
  levelColors: {
    dead: {
      type: String,
      default: 'danger',
      required: true
    },
    low: {
      type: String,
      default: 'info',
      required: true
    },
    moderate: {
      type: String,
      default: 'warning',
      required: true
    },
    active: {
      type: String,
      default: 'primary',
      required: true
    },
    superActive: {
      type: String,
      default: 'success',
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
    default: 'Candidate activity threshold settings for dashboard cards and leaderboards'
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
candidateActivityThresholdSchema.index({}, { unique: true });

// Pre-save middleware to validate thresholds
candidateActivityThresholdSchema.pre('save', function(next) {
  const { thresholds } = this;
  
  // Validate that thresholds are in ascending order
  if (thresholds.low >= thresholds.moderate) {
    return next(new Error('Low threshold must be less than moderate threshold'));
  }
  
  if (thresholds.moderate >= thresholds.active) {
    return next(new Error('Moderate threshold must be less than active threshold'));
  }
  
  if (thresholds.active >= thresholds.superActive) {
    return next(new Error('Active threshold must be less than super active threshold'));
  }
  
  next();
});

// Static method to get current settings
candidateActivityThresholdSchema.statics.getCurrentSettings = async function() {
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

// Instance method to calculate activity level
candidateActivityThresholdSchema.methods.calculateActivityLevel = function(activityScore) {
  const { thresholds, levelLabels, levelColors } = this;
  
  if (activityScore >= thresholds.superActive) {
    return {
      level: levelLabels.superActive,
      color: levelColors.superActive,
      score: activityScore
    };
  } else if (activityScore >= thresholds.active) {
    return {
      level: levelLabels.active,
      color: levelColors.active,
      score: activityScore
    };
  } else if (activityScore >= thresholds.moderate) {
    return {
      level: levelLabels.moderate,
      color: levelColors.moderate,
      score: activityScore
    };
  } else if (activityScore >= thresholds.low) {
    return {
      level: levelLabels.low,
      color: levelColors.low,
      score: activityScore
    };
  } else {
    return {
      level: levelLabels.dead,
      color: levelColors.dead,
      score: activityScore
    };
  }
};

// Instance method to get level distribution
candidateActivityThresholdSchema.methods.getLevelDistribution = function(candidates) {
  const distribution = {
    dead: 0,
    low: 0,
    moderate: 0,
    active: 0,
    superActive: 0
  };
  
  candidates.forEach(candidate => {
    const activityLevel = this.calculateActivityLevel(candidate.activityScore);
    const levelKey = activityLevel.level.toLowerCase().replace(' ', '');
    
    if (distribution.hasOwnProperty(levelKey)) {
      distribution[levelKey]++;
    }
  });
  
  return distribution;
};

module.exports = mongoose.model('CandidateActivityThreshold', candidateActivityThresholdSchema);
