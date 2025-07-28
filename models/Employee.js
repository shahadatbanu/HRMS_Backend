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
  // Bank details fields
  bankName: { type: String },
  accountNo: { type: String },
  ifsc: { type: String },
  branch: { type: String },
  // Personal information fields
  passportNumber: { type: String },
  passportExpiry: { type: Date },
  nationality: { type: String },
  religion: { type: String },
  maritalStatus: { type: String },
  spouseEmployment: { type: String },
  childrenCount: { type: Number },
  gender: { type: String },
  birthday: { type: Date },
  address: { type: String },
  // Emergency contacts
  emergencyContacts: [{
    name: { type: String },
    relationship: { type: String },
    phone: { type: String },
    type: { type: String, default: 'Emergency' }
  }],
  // Family information
  familyInfo: {
    name: { type: String },
    relationship: { type: String },
    dateOfBirth: { type: Date },
    phone: { type: String }
  },
  // Education details
  education: [{
    institution: { type: String },
    degree: { type: String },
    yearFrom: { type: String },
    yearTo: { type: String }
  }],
  // Experience details
  experience: [{
    company: { type: String },
    position: { type: String },
    startDate: { type: String },
    endDate: { type: String }
  }],
}, { timestamps: true });

export default mongoose.model('Employee', EmployeeSchema); 