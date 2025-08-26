const express = require('express');
const Designation = require('../models/Designation.js');
const auth = require('../middleware/auth.js');
const role = require('../middleware/role.js');

const router = express.Router();

// Get all designations
router.get('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const designations = await Designation.find();
    res.json({ success: true, data: designations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new designation
router.post('/', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const { name, status } = req.body;
    const designation = new Designation({ name, status });
    await designation.save();
    res.status(201).json({ success: true, data: designation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update a designation
router.put('/:id', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const { name, status } = req.body;
    const designation = await Designation.findByIdAndUpdate(
      req.params.id,
      { name, status },
      { new: true }
    );
    if (!designation) return res.status(404).json({ success: false, message: 'Designation not found' });
    res.json({ success: true, data: designation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete a designation
router.delete('/:id', auth, role(['admin', 'hr']), async (req, res) => {
  try {
    const designation = await Designation.findByIdAndDelete(req.params.id);
    if (!designation) return res.status(404).json({ success: false, message: 'Designation not found' });
    res.json({ success: true, message: 'Designation deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
