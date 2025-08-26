const express = require('express');
const Holiday = require('../models/Holiday.js');
const auth = require('../middleware/auth.js');
const role = require('../middleware/role.js');

const router = express.Router();

// Get all holidays
router.get('/', auth, async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.json({ success: true, data: holidays });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a single holiday by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });
    res.json({ success: true, data: holiday });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new holiday (admin/hr only)
router.post('/', [auth, role(['admin', 'hr'])], async (req, res) => {
  try {
    const { name, date, description } = req.body;
    const holiday = new Holiday({
      name,
      date,
      description,
      createdBy: req.user?._id,
    });
    await holiday.save();
    res.status(201).json({ success: true, message: 'Holiday created', data: holiday });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update a holiday (admin/hr only)
router.put('/:id', [auth, role(['admin', 'hr'])], async (req, res) => {
  try {
    const { name, date, description } = req.body;
    const holiday = await Holiday.findByIdAndUpdate(
      req.params.id,
      { name, date, description, updatedBy: req.user?._id },
      { new: true, runValidators: true }
    );
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });
    res.json({ success: true, message: 'Holiday updated', data: holiday });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete a holiday (admin/hr only)
router.delete('/:id', [auth, role(['admin', 'hr'])], async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });
    res.json({ success: true, message: 'Holiday deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
