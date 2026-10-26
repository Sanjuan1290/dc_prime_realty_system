/**
 * Format payroll/attendance duration directly from recorded minutes.
 * This is presentation-only: no change to stored attendance or salary math.
 */
export const formatPayrollDuration = (value) => {
  const numericMinutes = Number(value ?? 0)
  if (!Number.isFinite(numericMinutes) || numericMinutes < 0) return '—'

  const minutes = Math.round(numericMinutes)
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}h ${String(remainder).padStart(2, '0')}m`
}
