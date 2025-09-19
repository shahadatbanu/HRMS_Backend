const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db.js');
const authRoutes = require('./routes/auth.js');
const employeesRoutes = require('./routes/employees.js');
const candidatesRoutes = require('./routes/candidates.js');
const reportsRoutes = require('./routes/reports.js');
const attendanceRoutes = require('./routes/attendance.js');
const { router: attendanceSettingsRoutes } = require('./routes/attendanceSettings.js');
const cronService = require('./services/cronService.js');
const path = require('path');
const holidaysRoutes = require('./routes/holidays.js');
const leavesRoutes = require('./routes/leaves.js');
const terminationRoutes = require('./routes/termination.js');
const resignationRoutes = require('./routes/resignation');
const promotionsRoutes = require('./routes/promotions.js');
const todosRoutes = require('./routes/todos.js');
const activitiesRoutes = require('./routes/activities.js');
const performanceSettingsRoutes = require('./routes/performanceSettings.js');
const candidateActivityThresholdRoutes = require('./routes/candidateActivityThreshold.js');
const teamLeadsRoutes = require('./routes/teamLeads.js');

dotenv.config();

const app = express();

// Configure CORS to allow frontend access
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001', 
  'http://localhost:5173'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Connect to MongoDB
connectDB();

// Initialize cron service
cronService.initialize();

// Routes
app.use('/api/auth', authRoutes);

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Serve uploaded images with proper cache headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1y', // Cache for 1 year
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set cache headers for images
    if (path.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
    }
  }
}));

// Employee routes
app.use('/api/employees', employeesRoutes);

// Team leads routes
app.use('/api/employees', teamLeadsRoutes);

// Candidate routes
app.use('/api/candidates', candidatesRoutes);

// Reports routes
app.use('/api/reports', reportsRoutes);

// Attendance routes
app.use('/api/attendance', attendanceRoutes);

// Attendance settings routes
app.use('/api/attendance-settings', attendanceSettingsRoutes);

// Holidays routes
app.use('/api/holidays', holidaysRoutes);
// Designations routes
const designationsRoutes = require('./routes/designations.js');
app.use('/api/designations', designationsRoutes);
// Leave routes
app.use('/api/leaves', leavesRoutes);

// Termination routes
app.use('/api/termination', terminationRoutes);

// Resignation routes
app.use('/api/resignation', resignationRoutes);

// Promotion routes
app.use('/api/promotions', promotionsRoutes);

// Todo routes
app.use('/api/todos', todosRoutes);

// Activities routes
app.use('/api/activities', activitiesRoutes);

// Performance settings routes
app.use('/api/performance-settings', performanceSettingsRoutes);

// Candidate activity threshold routes
app.use('/api/candidate-activity-threshold', candidateActivityThresholdRoutes);

// Serve static assets with proper cache headers
app.use(express.static(path.join(__dirname, '../react/build'), {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set cache headers for different file types
    if (path.match(/\.(js|css)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (path.match(/\.(html)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 