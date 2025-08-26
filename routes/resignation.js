const express = require('express');
const Resignation = require('../models/Resignation');
const Employee = require('../models/Employee');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

const router = express.Router();

// Add a resignation
router.post('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const { employeeId, noticeDate, resignationDate, reason, description } = req.body;
    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    employee.resigned = true;
    employee.status = 'Inactive';
    await employee.save();
    const resignation = new Resignation({
      employee: employee._id,
      noticeDate,
      resignationDate,
      reason,
      description,
      createdBy: req.user._id
    });
    await resignation.save();
    res.status(201).json({ success: true, data: resignation });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get all resignations
router.get('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const resignations = await Resignation.find().populate('employee').sort({ resignationDate: -1 });
    res.json({ success: true, data: resignations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update a resignation
router.put('/:id', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const resignation = await Resignation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: resignation });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Delete a resignation
router.delete('/:id', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) return res.status(404).json({ message: 'Resignation not found' });
    const employee = await Employee.findById(resignation.employee);
    if (employee) {
      employee.resigned = false;
      employee.status = 'Active';
      await employee.save();
    }
    await Resignation.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
