const express = require('express');
const Termination = require('../models/Termination');
const Employee = require('../models/Employee');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

const router = express.Router();

// Add a termination
router.post('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const { employeeId, terminationType, noticeDate, terminationDate, reason, description } = req.body;
    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    employee.terminated = true;
    employee.status = 'Inactive'; // Set status to Inactive on termination
    await employee.save();
    const termination = new Termination({
      employee: employee._id,
      terminationType,
      noticeDate,
      terminationDate,
      reason,
      description,
      createdBy: req.user._id
    });
    await termination.save();
    res.status(201).json({ success: true, data: termination });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get all terminated employees with termination details
router.get('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const terminations = await Termination.find()
      .populate('employee')
      .sort({ terminationDate: -1 });
    res.json({ success: true, data: terminations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update a termination
router.put('/:id', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const termination = await Termination.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: termination });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Delete a termination
router.delete('/:id', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    await Termination.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
