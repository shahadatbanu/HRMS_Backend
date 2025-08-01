import mongoose from 'mongoose';

const CandidateSchema = new mongoose.Schema({
  // Auto-incremental Candidate ID
  candidateId: { 
    type: String, 
    unique: true,
    required: true 
  },
  
  // Basic Information
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    zipCode: { type: String }
  },
  
  // Professional Information
  currentRole: { type: String },
  currentTitle: { type: String },
  relevantExperience: { type: String },
  yearsOfExperience: { type: Number },
  
  // Technical Stack
  techStack: [{
    category: { type: String }, // e.g., "Programming Languages", "Frameworks", "Tools"
    skills: [{ type: String }]
  }],
  
  // Education
  education: [{
    institution: { type: String, required: true },
    degree: { type: String, required: true },
    fieldOfStudy: { type: String },
    yearFrom: { type: String },
    yearTo: { type: String },
    grade: { type: String },
    description: { type: String }
  }],
  
  // Certifications
  certifications: [{
    name: { type: String, required: true },
    issuingOrganization: { type: String },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    credentialId: { type: String },
    credentialUrl: { type: String }
  }],
  
  // Professional Experience
  experience: [{
    company: { type: String, required: true },
    position: { type: String, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    current: { type: Boolean, default: false },
    description: { type: String },
    technologies: [{ type: String }]
  }],
  
  // Documents
  cvFile: { type: String }, // File path/URL
  profileImage: { type: String }, // Profile image filename
  coverLetter: { type: String },
  portfolio: { type: String },
  
  // Recruitment Process
  status: {
    type: String,
    enum: ['New', 'Scheduled', 'Interviewed', 'Offered', 'Hired', 'Rejected'],
    default: 'New'
  },
  
  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // HR who assigned
  assignedDate: { type: Date },
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // Recruiter assigned to candidate
  
  // Application Details
  appliedRole: { type: String },
  appliedCompany: { type: String },
  source: { type: String }, // Reference, Direct, etc.
  
  // Interview Details
  interviews: [{
    scheduledDate: { type: Date },
    completedDate: { type: Date },
    interviewer: { type: String },
    notes: { type: String },
    feedback: { type: String },
    rating: { type: Number, min: 1, max: 5 },
    status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled'] }
  }],
  
  // Notes and Comments
  notes: [{
    content: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Attachments
  attachments: [{
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    description: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // Status tracking
  statusHistory: [{
    status: { type: String },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    changedAt: { type: Date, default: Date.now },
    notes: { type: String }
  }]
}, { timestamps: true });

export default mongoose.model('Candidate', CandidateSchema); 