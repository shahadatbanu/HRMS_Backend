const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  fromDesignation: {
    type: String,
    required: true
  },
  toDesignation: {
    type: String,
    required: true
  },
  promotionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  effectiveDate: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  promotionLetter: {
    fileName: { type: String },
    originalName: { type: String },
    fileType: { type: String },
    fileSize: { type: Number },
    uploadedAt: { type: Date, default: Date.now }
  },
  remarks: {
    type: String
  },
  // Soft delete fields
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  deletionReason: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Promotion', PromotionSchema);
