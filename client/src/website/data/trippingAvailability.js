const DEFAULT_SLOTS = ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM']

export const trippingConfig = {
  'luntiang-aguinaldo-bailen': {
    closedWeekdays: [3, 4], // Wednesday, Thursday
    slots: DEFAULT_SLOTS,
    leadTimeDays: 1,
  },
  'prime-enclave-maragondon': {
    closedWeekdays: [3, 4], // Wednesday, Thursday
    slots: DEFAULT_SLOTS,
    leadTimeDays: 1,
  },
}

export const availabilityLegend = [
  { value: 'available', label: 'Available' },
  { value: 'limited', label: 'Filling Up' },
  { value: 'full', label: 'Full' },
  { value: 'closed', label: 'Closed' },
]

const dateAtNoon = (value) => new Date(`${value}T12:00:00`)

export const toDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getProjectSchedule = (projectSlug) => trippingConfig[projectSlug] || {
  closedWeekdays: [3, 4],
  slots: DEFAULT_SLOTS,
  leadTimeDays: 1,
}

export const getMockAvailability = (projectSlug, dateKey) => {
  const schedule = getProjectSchedule(projectSlug)
  const date = dateAtNoon(dateKey)
  if (schedule.closedWeekdays.includes(date.getDay())) return 'closed'

  // Frontend preview only. The future booking API can return these same states.
  const seed = date.getDate() + (projectSlug || '').length + date.getMonth()
  if (seed % 11 === 0) return 'full'
  if (seed % 5 === 0) return 'limited'
  return 'available'
}

export const buildUpcomingDates = (projectSlug, count = 21) => {
  const dates = []
  const start = new Date()
  start.setHours(12, 0, 0, 0)

  for (let offset = 1; dates.length < count && offset <= 35; offset += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + offset)
    const dateKey = toDateKey(date)
    dates.push({
      dateKey,
      date,
      status: getMockAvailability(projectSlug, dateKey),
    })
  }
  return dates
}

