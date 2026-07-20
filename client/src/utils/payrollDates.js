const pad = (value) => String(value).padStart(2, '0')

const toIsoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const isPayrollReleaseDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const day = Number(String(value).slice(8, 10))
  return day === 7 || day === 22
}

export const getNextPayrollReleaseDate = (reference = new Date()) => {
  const date = reference instanceof Date ? new Date(reference) : new Date(`${reference}T00:00:00`)
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()

  if (day <= 7) return toIsoDate(new Date(year, month, 7))
  if (day <= 22) return toIsoDate(new Date(year, month, 22))
  return toIsoDate(new Date(year, month + 1, 7))
}

export const normalizePayrollReleaseDate = (value) => (
  isPayrollReleaseDate(value) ? value : getNextPayrollReleaseDate()
)

export const formatPayrollReleaseDate = (value) => {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}


