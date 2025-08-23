const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Employee = require('../models/Employee.js');
const Candidate = require('../models/Candidate.js');

dotenv.config();

const assignCandidates = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔧 Assigning candidates to nabil@gmail.com...\n');

    // 1. Find the employee
    const employee = await Employee.findOne({ email: 'nabil@gmail.com' });
    if (!employee) {
      console.log('❌ Employee nabil@gmail.com not found');
      return;
    }

    console.log('✅ Found employee:', `${employee.firstName} ${employee.lastName}`);

    // 2. Find unassigned candidates
    const unassignedCandidates = await Candidate.find({ assignedTo: { $exists: false } });
    console.log(`📊 Found ${unassignedCandidates.length} unassigned candidates`);

    if (unassignedCandidates.length === 0) {
      console.log('No unassigned candidates found. Checking all candidates...');
      const allCandidates = await Candidate.find({});
      console.log(`Total candidates: ${allCandidates.length}`);
      
      // Assign first 3 candidates to the employee
      const candidatesToAssign = allCandidates.slice(0, 3);
      
      for (const candidate of candidatesToAssign) {
        candidate.assignedTo = employee._id;
        candidate.assignedBy = employee._id;
        candidate.assignedDate = new Date();
        
        // Fix invalid status values
        let validStatus = candidate.status || 'New';
        if (!['New', 'Scheduled', 'Interviewed', 'Offered', 'Hired', 'Rejected'].includes(validStatus)) {
          validStatus = 'New';
        }
        
        // Also fix the candidate status if it's invalid
        if (!['New', 'Scheduled', 'Interviewed', 'Offered', 'Hired', 'Rejected'].includes(candidate.status)) {
          candidate.status = 'New';
        }
        
        // Add to status history
        if (!candidate.statusHistory) {
          candidate.statusHistory = [];
        }
        candidate.statusHistory.push({
          status: validStatus,
          changedBy: employee._id,
          notes: `Assigned to ${employee.firstName} ${employee.lastName}`
        });
        
        await candidate.save();
        console.log(`✅ Assigned: ${candidate.firstName} ${candidate.lastName}`);
      }
    } else {
      // Assign unassigned candidates
      for (const candidate of unassignedCandidates.slice(0, 3)) {
        candidate.assignedTo = employee._id;
        candidate.assignedBy = employee._id;
        candidate.assignedDate = new Date();
        
        // Fix invalid status values
        let validStatus = candidate.status || 'New';
        if (!['New', 'Scheduled', 'Interviewed', 'Offered', 'Hired', 'Rejected'].includes(validStatus)) {
          validStatus = 'New';
        }
        
        // Also fix the candidate status if it's invalid
        if (!['New', 'Scheduled', 'Interviewed', 'Offered', 'Hired', 'Rejected'].includes(candidate.status)) {
          candidate.status = 'New';
        }
        
        // Add to status history
        if (!candidate.statusHistory) {
          candidate.statusHistory = [];
        }
        candidate.statusHistory.push({
          status: validStatus,
          changedBy: employee._id,
          notes: `Assigned to ${employee.firstName} ${employee.lastName}`
        });
        
        await candidate.save();
        console.log(`✅ Assigned: ${candidate.firstName} ${candidate.lastName}`);
      }
    }

    // 3. Verify assignments
    const assignedCandidates = await Candidate.find({ assignedTo: employee._id });
    console.log(`\n📊 Now ${assignedCandidates.length} candidates are assigned to ${employee.firstName}:`);
    assignedCandidates.forEach(candidate => {
      console.log(`- ${candidate.firstName} ${candidate.lastName} (${candidate.email})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

assignCandidates(); 