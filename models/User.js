import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profileImage: { type: String }, // store filename or URL
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
  }]
}, { timestamps: true });

export default mongoose.model('User', UserSchema); 