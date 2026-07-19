import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import 'express-async-errors';

import { db } from './db/connect.js';
import { startDailyPenaltyJob } from './jobs/dailyPenalty.job.js';

// Routers
import userRouter from './routers/System/users.routers.js';
import documentsRouter from './routers/System/documents.routers.js';
import sellerGroupRouter from './routers/System/sellerGroup.routers.js';
import accreditedRouter from './routers/System/accredited.routers.js';
import projectsRouter from './routers/System/projects.routers.js';
import notificationsRouter from './routers/System/notifications.routers.js';
import auditLogsRouter from './routers/System/auditLogs.router.js';
import systemSettingsRouter from './routers/System/systemSettings.routers.js';
import employeesRouter from './routers/System/employees.routers.js';
import attendanceRouter from './routers/System/attendance.routers.js';
import employeeCashAdvancesRouter from './routers/System/employeeCashAdvances.routers.js';
import publicBuyerFormsRouter from './routers/publicBuyerForms.router.js';

const app = express();

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);

app.get('/', (req, res) => {
  res.json({ message: '✅ Server is running' });
});

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'success', message: 'API is healthy' });
});

// API Routers
app.use('/api/v1/public/buyer-forms', publicBuyerFormsRouter);
app.use('/api/v1/user', userRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/seller-groups', sellerGroupRouter);
app.use('/api/v1/accredited', accreditedRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/audit-logs', auditLogsRouter);
app.use('/api/v1/system-settings', systemSettingsRouter);
app.use('/api/v1/employees', employeesRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/employee-cash-advances', employeeCashAdvancesRouter);

app.use((err, req, res, next) => {
  console.error(err);
  const isDatabaseError = String(err?.code || '').startsWith('ER_') || err?.sqlMessage || err?.sql;
  res.status(500).json({ message: isDatabaseError ? 'Database operation failed. Please try again.' : err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await db.query('SELECT 1');
    console.log('✅ MySQL connected');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      startDailyPenaltyJob();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

