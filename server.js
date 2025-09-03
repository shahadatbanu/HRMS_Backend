const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db.js');
const authRoutes = require('./routes/auth.js');
const employeesRoutes = require('./routes/employees.js');
const candidatesRoutes = require('./routes/candidates.js');
const reportsRoutes = require('./routes/reports.js');
const attendanceRoutes = require('./routes/attendance.js');
const attendanceSettingsRoutes = require('./routes/attendanceSettings.js');
const cronService = require('./services/cronService.js');
const path = require('path');
const holidaysRoutes = require('./routes/holidays.js');
const leavesRoutes = require('./routes/leaves.js');
const terminationRoutes = require('./routes/termination.js');
const resignationRoutes = require('./routes/resignation');
const promotionsRoutes = require('./routes/promotions.js');
const todosRoutes = require('./routes/todos.js');
const activitiesRoutes = require('./routes/activities.js');
const serverless = require("serverless-http");

dotenv.config();

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://hrms-sha.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log("🔍 Incoming Origin:", origin);
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error("❌ CORS blocked:", origin);
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

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

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Employee routes
app.use('/api/employees', employeesRoutes);

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
app.use("/", (req, res) => {
  res.send("API is running....");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 

