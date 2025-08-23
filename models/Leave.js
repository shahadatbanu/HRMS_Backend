const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  leaveType: { type: String, enum: ['Full Day', 'Half Day', 'Medical Leave', 'Casual Leave', 'Annual Leave', 'Other'], required: true },
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  noOfDays: { type: Number, required: true },
  status: { type: String, enum: ['New', 'Approved', 'Declined', 'Cancelled'], default: 'New' },
  reason: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  approvedAt: { type: Date },
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
}, { timestamps: true });

module.exports = mongoose.model('Leave', LeaveSchema);
