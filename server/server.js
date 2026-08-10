import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import 'express-async-errors'

import { db } from './db/connect.js'
import { startDailyPenaltyJob } from './jobs/dailyPenalty.job.js'
import { parseTrustProxySetting } from './utils/requestIp.js'
import { maintenanceGuard } from './middleware/maintenance.middleware.js'

// Routers
import userRouter from './routers/System/users.routers.js'
import documentsRouter from './routers/System/documents.routers.js'
import sellerGroupRouter from './routers/System/sellerGroup.routers.js'
import accreditedRouter from './routers/System/accredited.routers.js'
import projectsRouter from './routers/System/projects.routers.js'
import notificationsRouter from './routers/System/notifications.routers.js'
import auditLogsRouter from './routers/System/auditLogs.router.js'
import systemSettingsRouter from './routers/System/systemSettings.routers.js'
import employeesRouter from './routers/System/employees.routers.js'
import attendanceRouter from './routers/System/attendance.routers.js'
import employeeCashAdvancesRouter from './routers/System/employeeCashAdvances.routers.js'
import publicBuyerFormsRouter from './routers/publicBuyerForms.router.js'
import publicSystemStatusRouter from './routers/publicSystemStatus.router.js'

const app = express()
app.disable('x-powered-by')

const trustProxySetting = parseTrustProxySetting(process.env.TRUST_PROXY)
if (trustProxySetting !== false) {
  app.set('trust proxy', trustProxySetting)
}

const normalizeOrigin = (value) =>
  String(value || '').trim().replace(/\/+$/, '')

const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean)

const allowedOrigins = new Set([
  ...configuredOrigins,
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:5173', 'http://localhost:5174']
    : []),
])

app.use(helmet())
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
        callback(null, true)
        return
      }

      const error = new Error('This website is not allowed to access the API.')
      error.statusCode = 403
      error.code = 'CORS_ORIGIN_BLOCKED'
      callback(error)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.get('/', (_req, res) => {
  res.json({ message: 'Server is running' })
})

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'success', message: 'API is healthy' })
})

// Public status must remain available during planned maintenance.
app.use('/api/v1/system-status', publicSystemStatusRouter)

// Blocks non-Super-Admin API traffic only while maintenance mode is enabled.
app.use('/api/v1', maintenanceGuard)

// API Routers
app.use('/api/v1/public/buyer-forms', publicBuyerFormsRouter)
app.use('/api/v1/user', userRouter)
app.use('/api/v1/documents', documentsRouter)
app.use('/api/v1/seller-groups', sellerGroupRouter)
app.use('/api/v1/accredited', accreditedRouter)
app.use('/api/v1/projects', projectsRouter)
app.use('/api/v1/notifications', notificationsRouter)
app.use('/api/v1/audit-logs', auditLogsRouter)
app.use('/api/v1/system-settings', systemSettingsRouter)
app.use('/api/v1/employees', employeesRouter)
app.use('/api/v1/attendance', attendanceRouter)
app.use('/api/v1/employee-cash-advances', employeeCashAdvancesRouter)

app.use((err, _req, res, _next) => {
  console.error(err)

  const isDatabaseError =
    String(err?.code || '').startsWith('ER_')
    || err?.sqlMessage
    || err?.sql

  const statusCode = Number(err?.statusCode || 0)
    || (isDatabaseError ? 503 : 500)

  res.status(statusCode).json({
    code: err?.code || (isDatabaseError ? 'SERVER_UNAVAILABLE' : 'INTERNAL_ERROR'),
    message: isDatabaseError
      ? 'Database operation failed. Please try again.'
      : err.message || 'Internal server error',
  })
})

const PORT = Number(process.env.PORT || 5001)
const HOST = '0.0.0.0'

const startServer = async () => {
  try {
    await db.query('SELECT 1')
    console.log('TiDB connected')

    app.listen(PORT, HOST, () => {
      console.log(`Server running on ${HOST}:${PORT}`)
      startDailyPenaltyJob()
    })
  } catch (error) {
    console.error('Failed to start server:', error.message)
    process.exit(1)
  }
}

startServer()


