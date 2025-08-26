const mongoose = require('mongoose');

const ResignationSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  noticeDate: { type: Date },
  resignationDate: { type: Date, required: true },
  reason: { type: String },
  description: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
}, { timestamps: true });

module.exports = mongoose.model('Resignation', ResignationSchema);
