import jwt from 'jsonwebtoken'
import { getSystemAvailability } from '../services/systemAvailability.service.js'

const exemptPaths = new Set([
  '/health',
  '/system-status',
  '/user/login',
  '/user/logout',
  '/user/me',
  '/user/change-password',
])

const isExemptPath = (path = '') =>
  exemptPaths.has(path)
  || path.startsWith('/user/forgot-password/')

const getSignedUserRole = (req) => {
  const token = req.cookies?.token
  if (!token) return null

  try {
    return jwt.verify(token, process.env.JWT_SECRET)?.role || null
  } catch {
    return null
  }
}

export const maintenanceGuard = async (req, res, next) => {
  if (isExemptPath(req.path)) {
    next()
    return
  }

  try {
    const availability = await getSystemAvailability()

    if (availability.status !== 'maintenance') {
      next()
      return
    }

    if (getSignedUserRole(req) === 'super_admin') {
      next()
      return
    }

    return res.status(503).json({
      code: 'MAINTENANCE_MODE',
      message:
        availability.maintenanceMessage
        || 'The system is temporarily under maintenance.',
    })
  } catch (error) {
    console.error('Maintenance status check failed:', error.message)

    return res.status(503).json({
      code: 'SERVER_UNAVAILABLE',
      message: 'The server is temporarily unavailable.',
    })
  }
}


