import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import employeesRoutes from './routes/employees.js';
import candidatesRoutes from './routes/candidates.js';
import reportsRoutes from './routes/reports.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Serve uploaded images
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Employee routes
app.use('/api/employees', employeesRoutes);

// Candidate routes
app.use('/api/candidates', candidatesRoutes);

// Reports routes
app.use('/api/reports', reportsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 