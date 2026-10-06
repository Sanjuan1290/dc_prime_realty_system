// Shows Operational Review snapshots as a readable comparison instead of raw
// JSON. Field keys are turned into plain labels, ids into names (using the
// lookups the server sends with the review), rates into percentages, money into
// pesos, and lists of records (for example project rates) into one card per
// record marked Added, Removed or Changed.

const FIELD_LABELS = Object.freeze({
  name: 'Name',
  description: 'Description',
  status: 'Status',
  groupType: 'Network type',
  headUserId: 'Hierarchy head',
  broker: 'Broker details',
  broker_name: 'Broker name',
  broker_license_number: 'Broker license number',
  realty_name: 'Realty name',
  broker_prc_number: 'PRC number',
  rates: 'Project rates',
  projectId: 'Project',
  lot_project_id: 'Project',
  poolRate: 'Pool rate',
  seller_group_pool_rate: 'Pool rate',
  companyProfitRate: 'Company profit',
  company_profit_rate: 'Company profit',
  divisionManagerRate: 'Division manager share',
  salesDirectorRate: 'Sales director share',
  unitManagerRate: 'Unit manager share',
  salesAgentRate: 'Sales agent share',
  division_manager_rate: 'Division manager share',
  sales_director_rate: 'Sales director share',
  unit_manager_rate: 'Unit manager share',
  sales_agent_rate: 'Sales agent share',
  externalAccount: 'External representative',
  listingId: 'Unit',
  listingIds: 'Units',
  unitCode: 'Unit code',
  lotType: 'Lot type',
  lotAreaSqm: 'Lot area (sqm)',
  oldUnitIds: 'Previous unit codes',
  soldSubstatus: 'Sold status',
  importedRows: 'Imported rows',
  batchReference: 'Import reference',
  filename: 'File name',
  groupId: 'Network',
  sellerGroupId: 'Network',
  userId: 'Person',
  tcp: 'TCP',
  lmf: 'Legal / misc fee',
  dp: 'Down payment',
})

const VALUE_LABELS = Object.freeze({
  in_house: 'In-House',
  external: 'External',
  active: 'Active',
  inactive: 'Inactive',
  deleted: 'Deleted',
  fully_paid: 'Fully paid',
})

// Technical keys that mean nothing to a reviewer.
const HIDDEN_KEY = /(_normalized|Normalized)$|^(projectSlug|storageCode|storage_code|documentRequirementsChanged|batchId|revision)$/

const LOOKUP_RULES = [
  { kind: 'project', test: (key) => /^(projectId|lotProjectId|lot_project_id|project_id)$/.test(key) },
  { kind: 'listing', test: (key) => /^(listingId|listingIds|lot_project_listing_id|listing_id)$/.test(key) },
  { kind: 'group', test: (key) => /^(groupId|sellerGroupId|seller_group_id|networkId)$/.test(key) },
  { kind: 'seller', test: (key) => /(SellerId|seller_id)$/i.test(key) && !/user/i.test(key) },
  { kind: 'user', test: (key) => /(^userId$|UserId$|user_id$)/.test(key) },
]

const IDENTITY_KEYS = ['projectId', 'lot_project_id', 'listingId', 'lot_project_listing_id', 'accreditedSellerId', 'accredited_seller_id', 'userId', 'id', 'key', 'code']

const humanize = (key = '') => {
  const words = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim()
    .toLowerCase()
  const cleaned = words.replace(/\bid\b$/, '').replace(/\bids\b$/, '').trim() || words
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

const fieldLabel = (key) => FIELD_LABELS[key] || humanize(key)

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isEmpty = (value) => value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

const trimNumber = (value, max = 4) => Number(value).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: max })
const peso = (value) => `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const lookupName = (key, value, lookups = {}) => {
  const rule = LOOKUP_RULES.find((entry) => entry.test(key))
  if (!rule) return null
  const name = lookups?.[rule.kind]?.[String(value)]
  return name || `#${value}`
}

const formatValue = (key, value, lookups = {}) => {
  if (isEmpty(value)) return 'Not set'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    const items = value.map((item) => formatValue(key, item, lookups))
    return items.length > 12 ? `${items.slice(0, 12).join(', ')} and ${items.length - 12} more` : items.join(', ')
  }
  if (isPlainObject(value)) return Object.entries(value).filter(([k]) => !HIDDEN_KEY.test(k)).map(([k, v]) => `${fieldLabel(k)}: ${formatValue(k, v, lookups)}`).join('; ')

  const numeric = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)) && /^-?\d+(\.\d+)?$/.test(value.trim()))
  const lookedUp = numeric ? lookupName(key, value, lookups) : null
  if (lookedUp) return lookedUp
  if (numeric && /(rate|percent|share)$/i.test(key)) return `${trimNumber(value)}%`
  if (numeric && /(amount|price|tcp|fee|balance|total|payment|commission|lmf|dp)$/i.test(key)) return peso(value)
  if (numeric) return trimNumber(value, 4)

  const text = String(value)
  if (VALUE_LABELS[text]) return VALUE_LABELS[text]
  if (/(At|_at|Date|_date)$/.test(key) && !Number.isNaN(Date.parse(text))) {
    return new Date(text).toLocaleString('en-PH', { dateStyle: 'medium', ...(text.length > 10 ? { timeStyle: 'short' } : {}) })
  }
  if (/^[a-z]+(_[a-z]+)+$/.test(text)) return humanize(text)
  return text
}

// Reading order for common fields; anything else keeps its saved order after these.
const FIELD_ORDER = ['name', 'groupType', 'status', 'broker', 'broker_name', 'broker_license_number', 'realty_name', 'broker_prc_number', 'headUserId', 'description',
  'poolRate', 'seller_group_pool_rate', 'companyProfitRate', 'company_profit_rate', 'divisionManagerRate', 'division_manager_rate', 'salesDirectorRate', 'sales_director_rate',
  'unitManagerRate', 'unit_manager_rate', 'salesAgentRate', 'sales_agent_rate', 'rates']
const orderOf = (key) => { const index = FIELD_ORDER.indexOf(key); return index === -1 ? FIELD_ORDER.length : index }

const visibleKeys = (...objects) => [...new Set(objects.flatMap((object) => (isPlainObject(object) ? Object.keys(object) : [])))]
  .filter((key) => !HIDDEN_KEY.test(key))
  .map((key, index) => ({ key, index }))
  .sort((a, b) => orderOf(a.key) - orderOf(b.key) || a.index - b.index)
  .map(({ key }) => key)

const isRecordList = (value) => Array.isArray(value) && value.some(isPlainObject)

// Flattens nested objects into labelled rows, e.g. "Broker details / Realty name".
const flattenRows = (before, after, prefix = []) => {
  const rows = []
  for (const key of visibleKeys(before, after)) {
    const b = isPlainObject(before) ? before[key] : undefined
    const a = isPlainObject(after) ? after[key] : undefined
    if (isRecordList(b) || isRecordList(a)) {
      rows.push({ type: 'list', key, path: [...prefix, key], before: Array.isArray(b) ? b : [], after: Array.isArray(a) ? a : [] })
    } else if (isPlainObject(b) || isPlainObject(a)) {
      rows.push(...flattenRows(isPlainObject(b) ? b : {}, isPlainObject(a) ? a : {}, [...prefix, key]))
    } else {
      rows.push({ type: 'field', key, path: [...prefix, key], before: b, after: a })
    }
  }
  return rows
}

const pathLabel = (path) => path.map(fieldLabel).join(' / ')

const identityKeyFor = (items) => {
  const sample = items.find(isPlainObject) || {}
  return IDENTITY_KEYS.find((key) => key in sample) || Object.keys(sample).find((key) => /(Id|_id)$/.test(key)) || null
}

const matchRecords = (before = [], after = []) => {
  const idKey = identityKeyFor([...before, ...after])
  const keyOf = (item, index) => (idKey && item?.[idKey] != null ? `${idKey}:${item[idKey]}` : `index:${index}`)
  const map = new Map()
  before.forEach((item, index) => map.set(keyOf(item, index), { before: item, after: undefined }))
  after.forEach((item, index) => {
    const key = keyOf(item, index)
    map.set(key, { ...(map.get(key) || { before: undefined }), after: item })
  })
  return { idKey, entries: [...map.values()] }
}

const recordTitle = (record, idKey, lookups, fallbackIndex) => {
  if (!record) return `Item ${fallbackIndex + 1}`
  if (idKey && record[idKey] != null) return formatValue(idKey, record[idKey], lookups)
  const named = ['name', 'label', 'title', 'unitCode'].find((key) => record[key])
  return named ? String(record[named]) : `Item ${fallbackIndex + 1}`
}

const STATE_STYLES = {
  added: { label: 'Added', badge: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-200' },
  removed: { label: 'Removed', badge: 'bg-red-100 text-red-800', border: 'border-red-200' },
  changed: { label: 'Changed', badge: 'bg-amber-100 text-amber-800', border: 'border-amber-200' },
  unchanged: { label: 'No change', badge: 'bg-slate-100 text-slate-600', border: 'border-slate-200' },
}

const ValueCell = ({ value, field, lookups, tone }) => {
  const empty = isEmpty(value)
  const tones = {
    before: 'text-red-800 line-through decoration-red-300',
    after: 'text-emerald-900',
    plain: 'text-slate-800',
  }
  return <span className={`break-words text-sm font-bold ${empty ? 'font-semibold italic text-slate-400 no-underline' : tones[tone] || tones.plain}`}>{formatValue(field, value, lookups)}</span>
}

const FieldTable = ({ rows, lookups, showUnchanged }) => {
  const visible = showUnchanged ? rows : rows.filter((row) => !same(row.before, row.after))
  if (!visible.length) return null
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[520px] text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs font-bold text-slate-500">
          <th className="w-[34%] py-2 pr-3">Field</th>
          <th className="w-[33%] py-2 pr-3">Before</th>
          <th className="w-[33%] py-2">After</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {visible.map((row) => {
          const changed = !same(row.before, row.after)
          return <tr key={row.path.join('.')} className={changed ? 'bg-amber-50/40' : ''}>
            <td className="py-2.5 pr-3 align-top text-sm font-semibold text-slate-600">{pathLabel(row.path)}</td>
            <td className="py-2.5 pr-3 align-top"><ValueCell value={row.before} field={row.key} lookups={lookups} tone={changed ? 'before' : 'plain'} /></td>
            <td className="py-2.5 align-top"><ValueCell value={row.after} field={row.key} lookups={lookups} tone={changed ? 'after' : 'plain'} /></td>
          </tr>
        })}
      </tbody>
    </table>
  </div>
}

const RecordListDiff = ({ row, lookups, showUnchanged }) => {
  const { idKey, entries } = matchRecords(row.before, row.after)
  const decorated = entries.map((entry, index) => {
    const state = entry.before === undefined ? 'added' : entry.after === undefined ? 'removed' : same(entry.before, entry.after) ? 'unchanged' : 'changed'
    return { ...entry, state, index }
  })
  const shown = showUnchanged ? decorated : decorated.filter((entry) => entry.state !== 'unchanged')
  const hiddenCount = decorated.length - shown.length
  if (!shown.length && !hiddenCount) return <p className="text-sm font-semibold italic text-slate-400">None</p>

  return <div className="grid gap-3">
    {shown.map((entry) => {
      const style = STATE_STYLES[entry.state]
      const title = recordTitle(entry.after || entry.before, idKey, lookups, entry.index)
      const fields = flattenRows(entry.before || {}, entry.after || {}).filter((field) => field.type === 'field' && field.key !== idKey)
      const single = entry.state === 'added' || entry.state === 'removed'
      return <div key={`${title}-${entry.index}`} className={`rounded-xl border bg-white ${style.border}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <p className="text-sm font-black text-slate-900">{title}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>{style.label}</span>
        </div>
        <div className="px-4 py-2">
          {single
            ? <dl className="grid gap-x-6 gap-y-2 py-1 sm:grid-cols-2">
                {fields.map((field) => <div key={field.path.join('.')} className="flex items-baseline justify-between gap-3 border-b border-dashed border-slate-100 pb-1.5">
                  <dt className="text-sm font-semibold text-slate-500">{pathLabel(field.path)}</dt>
                  <dd className={`text-right text-sm font-bold ${entry.state === 'removed' ? 'text-red-800 line-through decoration-red-300' : 'text-emerald-900'}`}>{formatValue(field.key, entry.state === 'removed' ? field.before : field.after, lookups)}</dd>
                </div>)}
              </dl>
            : <FieldTable rows={fields} lookups={lookups} showUnchanged={showUnchanged} />}
        </div>
      </div>
    })}
    {hiddenCount ? <p className="text-xs font-semibold text-slate-500">{hiddenCount} other {hiddenCount === 1 ? 'entry is' : 'entries are'} unchanged.</p> : null}
  </div>
}

const parse = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}

/**
 * mode="changes": only what changed between before and after.
 * mode="full": every field of both snapshots side by side.
 */
const ReviewSnapshotDiff = ({ beforeValue, afterValue, lookups = {}, mode = 'changes' }) => {
  const before = parse(beforeValue) || {}
  const after = parse(afterValue) || {}
  const showUnchanged = mode === 'full'
  const rows = flattenRows(before, after)
  const fieldRows = rows.filter((row) => row.type === 'field')
  const listRows = rows.filter((row) => row.type === 'list' && (showUnchanged || !same(row.before, row.after)))
  const changedFieldCount = fieldRows.filter((row) => !same(row.before, row.after)).length
  const isNewRecord = !parse(beforeValue)

  if (!showUnchanged && !changedFieldCount && !listRows.length) {
    return <p className="text-sm font-semibold text-emerald-800">The saved values before and after this action are the same.</p>
  }

  return <div className="grid gap-5">
    {isNewRecord && !showUnchanged ? <p className="text-sm font-semibold text-slate-500">This record was newly created, so there are no earlier values.</p> : null}
    {(showUnchanged ? fieldRows.length : changedFieldCount) ? <FieldTable rows={fieldRows} lookups={lookups} showUnchanged={showUnchanged} /> : null}
    {listRows.map((row) => <div key={row.path.join('.')} className="grid gap-2">
      <p className="text-sm font-black text-slate-800">{pathLabel(row.path)}</p>
      <RecordListDiff row={row} lookups={lookups} showUnchanged={showUnchanged} />
    </div>)}
  </div>
}

export default ReviewSnapshotDiff
