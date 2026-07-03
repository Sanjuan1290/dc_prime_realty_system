

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import 'express-async-errors';

import { db } from './db/connect.js';

// System Routers
import userRouter from './routers/System/users.routers.js';
import documentsRouter from './routers/System/documents.routers.js';
import sellerGroupRouter from './routers/System/sellerGroup.routers.js';
import accreditedRouter from './routers/System/accredited.routers.js';

// Bailen Routers
import bailenDashboardRouter from './routers/BailenProject/dashboard.routers.js';
import bailenListingsRouter from './routers/BailenProject/listings.routers.js';
import bailenListingProfileRouter from './routers/BailenProject/listingProfile.routers.js';
import bailenPaymentsRouter from './routers/BailenProject/payments.routers.js';
import bailenPaymentLogsRouter from './routers/BailenProject/paymentLogs.routers.js';
import bailenCommissionsRouter from './routers/BailenProject/commissions.routers.js';


const app = express();

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
    credentials: true,
  })
);

app.get('/', (req, res) => {
  res.json({ message: '✅ Server is running' });
});

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'success', message: 'API is healthy' });
});

// System Routers
app.use('/api/v1/user', userRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/seller-groups', sellerGroupRouter);
app.use('/api/v1/accredited', accreditedRouter);

// Bailen Routers
app.use('/api/v1/bailen/dashboard', bailenDashboardRouter);
app.use('/api/v1/bailen/listings', bailenListingsRouter);
app.use('/api/v1/bailen/listing-profile', bailenListingProfileRouter);
app.use('/api/v1/bailen/payments', bailenPaymentsRouter);
app.use('/api/v1/bailen/payment-logs', bailenPaymentLogsRouter);
app.use('/api/v1/bailen/commissions', bailenCommissionsRouter);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Unhandled server error:', err);
  return res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, async () => {
  try {
    console.log(`Server running on port ${PORT}`);
    await db.query('SELECT 1');
    console.log('🟢 Database connected successfully');
  } catch (err) {
    console.error('Failed to start server:', err.message);
    console.log('🔴 Database connection failed');
    process.exit(1);
  }
});
