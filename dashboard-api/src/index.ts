import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { pool } from './db.js';

import authRoutes from './routes/auth.js';
import calendarRoutes from './routes/calendar.js';
import settingsRoutes from './routes/settings.js';
import recordingsRoutes from './routes/recordings.js';
import botRoutes from './routes/bot.js';
import sharedRoutes from './routes/shared.js';
import adminRoutes from './routes/admin.js';

const app = express();

// Trust proxy for secure cookies behind Caddy
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: [
    config.frontendUrl,
    'http://localhost:3000',
    'https://recordingbot.josueortiz.dev',
  ],
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', async (_req, res) => {
  try {
    const dbTest = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      dbConnected: Boolean(dbTest.rows[0]),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// Mount Routes
app.use('/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/shared', sharedRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Dashboard-API Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

app.listen(config.port, () => {
  console.log('=============================================');
  console.log(`  RecordingBot Dashboard API on port ${config.port}`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`  Frontend URL: ${config.frontendUrl}`);
  console.log('=============================================');
});
