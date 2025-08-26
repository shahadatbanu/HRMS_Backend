const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Employee = require('../models/Employee.js');
const Candidate = require('../models/Candidate.js');

dotenv.config();

const verifyAllAssignments = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔍 Verifying all candidate assignments...\n');

    // 1. Get all candidates with their assignments
    const allCandidates = await Candidate.find({})
      .populate('assignedTo', 'firstName lastName email')
      .sort({ candidateId: 1 });

    console.log(`📊 Total candidates in system: ${allCandidates.length}\n`);

    console.log('📋 All candidates and their assignments:');
    allCandidates.forEach((candidate, index) => {
      const assignedTo = candidate.assignedTo ? 
        `${candidate.assignedTo.firstName} ${candidate.assignedTo.lastName} (${candidate.assignedTo.email})` : 
        'Not assigned';
      console.log(`${index + 1}. ${candidate.candidateId} - ${candidate.firstName} ${candidate.lastName}`);
      console.log(`   Email: ${candidate.email}`);
      console.log(`   Status: ${candidate.status}`);
      console.log(`   Assigned to: ${assignedTo}`);
      console.log('');
    });

    // 2. Check nabil's assignments specifically
    const nabilEmployee = await Employee.findOne({ email: 'nabil@gmail.com' });
    
    console.log(`\n👤 Nabil's assignments:`);
    console.log(`Employee ID: ${nabilEmployee._id}`);
    
    const nabilAssignments = await Candidate.find({ assignedTo: nabilEmployee._id })
      .populate('assignedTo', 'firstName lastName email');
    
    console.log(`\n📊 Candidates assigned to nabil: ${nabilAssignments.length}`);
    nabilAssignments.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.candidateId} - ${candidate.firstName} ${candidate.lastName} (${candidate.email})`);
    });

    // 3. Check unassigned candidates
    const unassignedCandidates = await Candidate.find({ assignedTo: { $exists: false } });
    console.log(`\n📊 Unassigned candidates: ${unassignedCandidates.length}`);
    unassignedCandidates.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.candidateId} - ${candidate.firstName} ${candidate.lastName} (${candidate.email})`);
    });

    // 4. Check if Cand-006 is properly assigned
    const candidate006 = await Candidate.findOne({ candidateId: 'Cand-006' })
      .populate('assignedTo', 'firstName lastName email');
    
    if (candidate006) {
      console.log(`\n🔍 Candidate 006 details:`);
      console.log(`ID: ${candidate006._id}`);
      console.log(`Candidate ID: ${candidate006.candidateId}`);
      console.log(`Name: ${candidate006.firstName} ${candidate006.lastName}`);
      console.log(`Email: ${candidate006.email}`);
      console.log(`Status: ${candidate006.status}`);
      console.log(`Assigned to: ${candidate006.assignedTo ? `${candidate006.assignedTo.firstName} ${candidate006.assignedTo.lastName}` : 'Not assigned'}`);
      console.log(`Assigned by: ${candidate006.assignedBy}`);
      console.log(`Assigned date: ${candidate006.assignedDate}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

verifyAllAssignments(); 