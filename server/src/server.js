import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import holidayRoutes from './routes/holidayRoutes.js';
import { testConnection } from './config/db.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { sweepDueAutoCloseTickets } from './services/sweeperService.js';

import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.join(__dirname, '../../client/dist');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging in dev
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    // console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FRONTDESK API',
    timezone: 'Asia/Kolkata',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/holidays', holidayRoutes);

// Serve Client Static Build
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Server Initialization
export async function startServer() {
  console.log('🚀 Starting FRONTDESK Backend Server...');

  // 1. Test Database Connection & Auto-migrate
  const isDbConnected = await testConnection();
  if (isDbConnected) {
    try {
      await runMigrations();
      await seedDatabase();
      
      // 2. Cold-Start Auto-Close Sweep
      console.log('🧹 Executing on-boot auto-close sweep...');
      await sweepDueAutoCloseTickets();
    } catch (err) {
      console.warn('⚠️ DB Initialization warning:', err.message);
    }
  } else {
    console.warn('⚠️ Starting server without active PostgreSQL connection. Database operations will wait for DATABASE_URL.');
  }

  // 3. Periodic Background Sweeper (every 5 minutes while container is awake)
  setInterval(async () => {
    try {
      await sweepDueAutoCloseTickets();
    } catch (err) {
      console.error('Periodic sweep error:', err.message);
    }
  }, 5 * 60 * 1000);

  const server = app.listen(PORT, () => {
    console.log(`✅ FRONTDESK API Server running on port ${PORT}`);
    console.log(`🌐 Base URL: http://localhost:${PORT}`);
  });

  return { app, server };
}

// Start if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
