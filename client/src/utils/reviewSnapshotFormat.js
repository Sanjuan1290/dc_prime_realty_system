// Shared formatting for Review Center snapshots: turns saved values into what a
// reviewer reads (names instead of ids, % for rates, pesos for amounts).

const VALUE_LABELS = Object.freeze({
  in_house: 'In-House',
  external: 'External',
  active: 'Active',
  inactive: 'Inactive',
  deleted: 'Deleted',
  fully_paid: 'Fully Paid',
})

const LOOKUP_RULES = [
  { kind: 'project', test: (key) => /^(projectId|lotProjectId|lot_project_id|project_id)$/.test(key) },
  { kind: 'listing', test: (key) => /^(listingId|listingIds|lot_project_listing_id|listing_id)$/.test(key) },
  { kind: 'group', test: (key) => /^(groupId|sellerGroupId|seller_group_id|networkId)$/.test(key) },
  { kind: 'seller', test: (key) => /(SellerId|seller_id)$/i.test(key) && !/user/i.test(key) },
  { kind: 'user', test: (key) => /(^userId$|UserId$|user_id$)/.test(key) },
]

const IDENTITY_KEYS = ['projectId', 'lot_project_id', 'listingId', 'lot_project_listing_id', 'accreditedSellerId', 'accredited_seller_id', 'userId', 'id', 'key', 'code']

export const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
export const isEmptyValue = (value) => value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)
export const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export const parseSnapshotValue = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}

// "divisionManagerRate" -> "Division Manager Rate", "lot_project_id" -> "Lot Project"
export const humanizeKey = (key = '') => {
  const words = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim()
    .toLowerCase()
  const cleaned = words.replace(/\bids?\b$/, '').trim() || words
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
}

const trimNumber = (value, max = 4) => Number(value).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: max })
const peso = (value) => `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const lookupName = (key, value, lookups = {}) => {
  const rule = LOOKUP_RULES.find((entry) => entry.test(key))
  if (!rule) return null
  return lookups?.[rule.kind]?.[String(value)] || `#${value}`
}

export const formatSnapshotValue = (key, value, { lookups = {}, labelFor = humanizeKey, isHidden = () => false } = {}) => {
  if (isEmptyValue(value)) return 'Not set'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    const items = value.map((item) => formatSnapshotValue(key, item, { lookups, labelFor, isHidden }))
    return items.length > 12 ? `${items.slice(0, 12).join(', ')} and ${items.length - 12} more` : items.join(', ')
  }
  if (isPlainObject(value)) {
    return Object.entries(value)
      .filter(([childKey]) => !isHidden(childKey))
      .map(([childKey, childValue]) => `${labelFor(childKey)}: ${formatSnapshotValue(childKey, childValue, { lookups, labelFor, isHidden })}`)
      .join('; ')
  }
  const numeric = typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()))
  if (numeric) {
    const name = lookupName(key, value, lookups)
    if (name) return name
    if (/(rate|percent|share)$/i.test(key)) return `${trimNumber(value)}%`
    if (/(amount|price|tcp|fee|balance|total|payment|commission|lmf|dp)$/i.test(key)) return peso(value)
    return trimNumber(value, 4)
  }
  const text = String(value)
  if (VALUE_LABELS[text]) return VALUE_LABELS[text]
  if (/(At|_at|Date|_date)$/.test(key) && !Number.isNaN(Date.parse(text))) {
    return new Date(text).toLocaleString('en-PH', { dateStyle: 'medium', ...(text.length > 10 ? { timeStyle: 'short' } : {}) })
  }
  if (/^[a-z]+(_[a-z]+)+$/.test(text)) return humanizeKey(text)
  return text
}

// Pairs records from the before and after lists by their id (projectId etc.).
export const matchSnapshotRecords = (before = [], after = []) => {
  const sample = [...before, ...after].find(isPlainObject) || {}
  const idKey = IDENTITY_KEYS.find((key) => key in sample) || Object.keys(sample).find((key) => /(Id|_id)$/.test(key)) || null
  const keyOf = (item, index) => (idKey && item?.[idKey] != null ? `${idKey}:${item[idKey]}` : `index:${index}`)
  const map = new Map()
  before.forEach((item, index) => map.set(keyOf(item, index), { before: item, after: undefined }))
  after.forEach((item, index) => {
    const key = keyOf(item, index)
    map.set(key, { ...(map.get(key) || { before: undefined }), after: item })
  })
  const entries = [...map.values()].map((entry, index) => ({
    ...entry,
    index,
    state: entry.before === undefined ? 'added' : entry.after === undefined ? 'removed' : sameValue(entry.before, entry.after) ? 'unchanged' : 'changed',
  }))
  return { idKey, entries }
}

export const RECORD_STATE_STYLES = Object.freeze({
  added: { label: 'Added', badge: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-200' },
  removed: { label: 'Removed', badge: 'bg-red-100 text-red-800', border: 'border-red-200' },
  changed: { label: 'Changed', badge: 'bg-amber-100 text-amber-800', border: 'border-amber-200' },
  unchanged: { label: 'No Change', badge: 'bg-slate-100 text-slate-600', border: 'border-slate-200' },
})
