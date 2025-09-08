const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  // Authentication fields (from User schema)
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'hr', 'employee'], 
    default: 'employee' 
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  permissions: [{
    module: { type: String }, // e.g., 'candidates', 'reports', 'settings'
    actions: [{ type: String }] // e.g., ['create', 'read', 'update', 'delete']
  }],
  
  // Personal Information (existing Employee fields)
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true },
  joiningDate: { type: Date, required: true },
  username: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  company: { type: String, required: true },
  department: { type: String, required: true },
  designation: { type: String, required: true },
  about: { type: String },
  profileImage: { type: String }, // store filename or URL
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  
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

  // Assigned assets
  assets: [{
    itemName: { type: String },
    assetCode: { type: String },
    image: { type: String },
    assignedBy: { type: String },
    assignedOn: { type: Date },
    note: { type: String },
  }],

  // Team structure
  teamLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // For recruiters to reference their team lead

  // Termination status
  terminated: { type: Boolean, default: false },
  resigned: { type: Boolean, default: false },
  
  // Soft delete fields
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  deletionReason: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Employee', EmployeeSchema); 