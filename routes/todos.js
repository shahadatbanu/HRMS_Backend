const express = require('express');
const Todo = require('../models/Todo.js');
const auth = require('../middleware/auth.js');

const router = express.Router();

// Protect all todo routes
router.use(auth);

// GET all todos for the authenticated user
router.get('/', async (req, res) => {
  try {
    const { completed, category, limit = 10, page = 1 } = req.query;
    
    const filter = { 
      createdBy: req.user.id,
      isDeleted: { $ne: true }
    };
    
    // Add filters if provided
    if (completed !== undefined) {
      filter.completed = completed === 'true';
    }
    
    if (category) {
      filter.category = category;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const todos = await Todo.find(filter)
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Todo.countDocuments(filter);
    
    res.json({
      data: todos,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Error fetching todos:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET single todo by ID
router.get('/:id', async (req, res) => {
  try {
    const todo = await Todo.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      isDeleted: { $ne: true }
    }).populate('assignedTo', 'firstName lastName');
    
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }
    
    res.json(todo);
  } catch (err) {
    console.error('Error fetching todo:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST create new todo
router.post('/', async (req, res) => {
  try {
    const { title, description, priority, dueDate, assignedTo, category } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ message: 'Title is required' });
    }
    
    const todo = new Todo({
      title: title.trim(),
      description: description?.trim(),
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedTo: assignedTo || null,
      category: category || 'work',
      createdBy: req.user.id
    });
    
    await todo.save();
    
    // Populate assignedTo field for response
    await todo.populate('assignedTo', 'firstName lastName');
    
    res.status(201).json(todo);
  } catch (err) {
    console.error('Error creating todo:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update todo
router.put('/:id', async (req, res) => {
  try {
    const { title, description, completed, priority, dueDate, assignedTo, category } = req.body;
    
    const todo = await Todo.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      isDeleted: { $ne: true }
    });
    
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }
    
    // Update fields if provided
    if (title !== undefined) todo.title = title.trim();
    if (description !== undefined) todo.description = description?.trim();
    if (completed !== undefined) todo.completed = completed;
    if (priority !== undefined) todo.priority = priority;
    if (dueDate !== undefined) todo.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedTo !== undefined) todo.assignedTo = assignedTo || null;
    if (category !== undefined) todo.category = category;
    
    await todo.save();
    
    // Populate assignedTo field for response
    await todo.populate('assignedTo', 'firstName lastName');
    
    res.json(todo);
  } catch (err) {
    console.error('Error updating todo:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE todo (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const todo = await Todo.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      isDeleted: { $ne: true }
    });
    
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }
    
    todo.isDeleted = true;
    await todo.save();
    
    res.json({ message: 'Todo deleted successfully' });
  } catch (err) {
    console.error('Error deleting todo:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH toggle todo completion
router.patch('/:id/toggle', async (req, res) => {
  try {
    const todo = await Todo.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      isDeleted: { $ne: true }
    });
    
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }
    
    todo.completed = !todo.completed;
    await todo.save();
    
    // Populate assignedTo field for response
    await todo.populate('assignedTo', 'firstName lastName');
    
    res.json(todo);
  } catch (err) {
    console.error('Error toggling todo:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
