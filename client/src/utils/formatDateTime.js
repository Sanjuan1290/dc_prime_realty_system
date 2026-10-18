// Shared D&C Prime Realty date handling.
// Business instants are returned as offset-less MySQL DATETIME strings.
// IMPORTANT: Their source timezone MUST be verified against the application
// TiDB session (SELECT @@session.time_zone, NOW(), UTC_TIMESTAMP()).
// Current default follows the UTC source convention observed in Review Center.
// ISO values with Z or +/-HH:mm are always respected as supplied.
export const BUSINESS_TIME_ZONE = 'Asia/Manila'
// Default is UTC to match the previously observed 8-hour display discrepancy.
// If the live app TiDB session stores DATETIME in PHT, set
// VITE_DB_DATETIME_SOURCE_TIME_ZONE=Asia/Manila and rebuild the frontend.
export const DEFAULT_NAIVE_TIME_ZONE = import.meta.env?.VITE_DB_DATETIME_SOURCE_TIME_ZONE === 'Asia/Manila'
  ? 'Asia/Manila' : 'UTC'

const NAIVE_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/
const EXPLICIT_OFFSET = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export const parseBusinessTimestamp = (value, { naiveTimeZone = DEFAULT_NAIVE_TIME_ZONE } = {}) => {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (DATE_ONLY.test(raw)) return null // calendar dates are NOT timestamps
  const naive = raw.match(NAIVE_TIMESTAMP)
  if (naive) {
    const base = `${naive[1]}T${naive[2]}:${naive[3] || '00'}${naive[4] ? `.${naive[4]}` : ''}`
    if (naiveTimeZone !== 'UTC' && naiveTimeZone !== 'Asia/Manila') {
      throw new Error('Unsupported source timezone. Verify the TiDB session timezone first.')
    }
    const date = new Date(`${base}Z`)
    if (naiveTimeZone === 'Asia/Manila') date.setTime(date.getTime() - 8 * 3600_000)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (!EXPLICIT_OFFSET.test(raw)) return null
  const normalized = raw.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatPhilippineDateTime = (value, {
  fallback = '-', naiveTimeZone = DEFAULT_NAIVE_TIME_ZONE, timeZoneLabel = false,
  dateStyle = 'medium', timeStyle = 'short',
} = {}) => {
  const date = parseBusinessTimestamp(value, { naiveTimeZone })
  if (!date) return fallback
  const result = new Intl.DateTimeFormat('en-PH', {
    timeZone: BUSINESS_TIME_ZONE, dateStyle, timeStyle,
  }).format(date)
  return timeZoneLabel ? `${result} PHT` : result
}

// Contractual due dates and payment dates are DATE columns, not instants.
// Do not use the viewer's local timezone when formatting them.
export const formatPhilippineCalendarDate = (value, { fallback = '-', style = 'iso' } = {}) => {
  if (!value) return fallback
  let date
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?=$|[ T])/ )
    if (!match) return String(value)
    date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    if (date.toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}`) return String(value)
  } else {
    date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
  }
  if (style === 'iso') return date.toISOString().slice(0, 10)
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC', dateStyle: style === 'long' ? 'long' : 'medium',
  }).format(date)
}

export const formatDateOnly = (value) => formatPhilippineCalendarDate(value)

// Preserve the pre-existing yyyy-MM-dd HH:mm display contract for callers.
export const formatDateTime = (value) => {
  if (!value) return '-'
  if (typeof value === 'string' && DATE_ONLY.test(value.trim())) return value.trim()
  const date = parseBusinessTimestamp(value)
  if (!date) return String(value)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

