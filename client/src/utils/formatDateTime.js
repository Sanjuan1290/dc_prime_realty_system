const toDateOnly = (value) => {
  if (!value) return '-'
  if (typeof value === 'string') {
    const clean = value.trim()
    const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export const formatDateOnly = toDateOnly

export const formatDateTime = (dateString) => {
  if (!dateString) return '-'

  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
    return dateString.trim()
  }

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return String(dateString)

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type) => parts.find((part) => part.type === type)?.value

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

