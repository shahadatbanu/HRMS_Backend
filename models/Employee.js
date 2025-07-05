import mongoose from 'mongoose';

const EmployeeSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true },
  joiningDate: { type: Date, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  company: { type: String, required: true },
  department: { type: String, required: true },
  designation: { type: String, required: true },
  about: { type: String },
  profileImage: { type: String }, // store filename or URL
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model('Employee', EmployeeSchema); 