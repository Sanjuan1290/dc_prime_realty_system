import { db } from '../db/connect.js'

const cacheMs = Math.max(Number(process.env.SYSTEM_STATUS_CACHE_MS || 5_000), 0)
let cachedValue = null
let cachedUntil = 0

const mapAvailability = (row = {}) => ({
  status: row.system_status === 'maintenance' ? 'maintenance' : 'active',
  maintenanceMessage: row.maintenance_message || null,
})

export const clearSystemAvailabilityCache = () => {
  cachedValue = null
  cachedUntil = 0
}

export const getSystemAvailability = async ({ force = false } = {}) => {
  const now = Date.now()

  if (!force && cachedValue && cachedUntil > now) {
    return cachedValue
  }

  const [rows] = await db.query(
    `
      SELECT system_status, maintenance_message
      FROM system_settings
      WHERE system_setting_id = 1
      LIMIT 1
    `
  )

  cachedValue = mapAvailability(rows[0])
  cachedUntil = now + cacheMs

  return cachedValue
}

