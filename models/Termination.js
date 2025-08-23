const mongoose = require('mongoose');

const TerminationSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  terminationType: { type: String, required: true },
  noticeDate: { type: Date },
  terminationDate: { type: Date, required: true },
  reason: { type: String },
  description: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
}, { timestamps: true });

module.exports = mongoose.model('Termination', TerminationSchema);
