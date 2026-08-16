export const isBlank = (value) => value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '-' || String(value).trim() === '—'

export const displayValue = (value, emptyText = 'Not provided') => {
  if (isBlank(value)) return emptyText
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

export const money = (value) => {
  if (isBlank(value)) return 'Not provided'
  const number = Number(value)
  if (!Number.isFinite(number)) return displayValue(value)
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number)
}

export const percent = (value) => {
  if (isBlank(value)) return 'Not provided'
  const text = String(value).trim()
  return text.endsWith('%') ? text : `${text}%`
}

export const formatDate = (value) => {
  if (isBlank(value)) return 'Not provided'
  const text = String(value).trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return text
  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

export const titleCase = (value) => {
  if (isBlank(value)) return 'Not provided'
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export const roleLabel = (value) => ({
  super_admin: 'Super Admin',
  admin: 'Admin',
  division_manager: 'Division Manager',
  sales_director: 'Sales Director',
  unit_manager: 'Unit Manager',
  sales_agent: 'Sales Agent',
  broker_head: 'Broker Head',
}[String(value || '')] || titleCase(value))

export const requirementLabel = (value) => {
  if (isBlank(value)) return 'Not provided'
  return String(value).toLowerCase() === 'optional' || value === false || value === 0 || value === '0' ? 'Optional' : 'Required'
}
export const statusLabel = (value) => titleCase(value)

export const pick = (object, ...keys) => {
  const source = object || {}
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && !isBlank(source[key])) return source[key]
  }
  return ''
}
