import mongoose from 'mongoose';

const EmployeeSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  employeeId: { type: String, unique: true },
  email: { type: String, unique: true },
  phone: String,
  department: String,
  designation: String,
  joiningDate: Date,
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  about: String,
  image: String,
}, { timestamps: true });

export default mongoose.model('Employee', EmployeeSchema); 