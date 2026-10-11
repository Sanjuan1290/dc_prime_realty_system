export const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`

export const decimalHours = (minutes) => (Number(minutes || 0) / 60).toLocaleString('en-PH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const formatPayrollDate = (value, options = {}) => {
  const date = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return value || '—'
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: options.short ? 'short' : 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(`${date}T00:00:00+08:00`))
}

export const employmentLabel = (value) => ({
  regular: 'Full Time',
  probationary: 'Probationary',
  contractual: 'Contractual',
  part_time: 'Part Time',
  intern: 'Intern',
}[value] || value || '—')

export const payrollStatusLabel = (value) => ({
  draft: 'Draft',
  finalized: 'Finalized',
  cancelled: 'Cancelled',
  released: 'Released',
  corrected: 'Corrected',
}[value] || value || '—')

export const payrollStatusTone = (value) => ({
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
  finalized: 'bg-blue-50 text-blue-700 ring-blue-200',
  released: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  corrected: 'bg-violet-50 text-violet-700 ring-violet-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
}[value] || 'bg-slate-100 text-slate-600 ring-slate-200')

export const payrollAdditionTotal = (row = {}) => [
  row.overtime_pay,
  row.rest_day_overtime_pay,
  row.regular_holiday_pay,
  row.special_holiday_pay,
  row.night_differential_pay,
  row.manual_additions_total,
].reduce((sum, value) => sum + Number(value || 0), 0)

export const payrollAllowanceTotal = (row = {}) => [
  row.rice_allowance,
  row.transportation_allowance,
  row.attendance_bonus,
].reduce((sum, value) => sum + Number(value || 0), 0)

export const getManilaMonth = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}

