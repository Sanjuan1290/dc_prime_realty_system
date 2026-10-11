// Generic before/after comparison for Operational Review snapshots. The page
// that uses it supplies the vocabulary (labels, which fields are technical, and
// special renderers for record lists such as Network project rates), so no raw
// keys or JSON ever reach the screen.
import {
  formatSnapshotValue,
  humanizeKey,
  isEmptyValue,
  isPlainObject,
  matchSnapshotRecords,
  parseSnapshotValue,
  RECORD_STATE_STYLES,
  sameValue,
} from '../../utils/reviewSnapshotFormat'

const defaultIsHidden = (key) => /(_normalized|Normalized)$/.test(String(key))

const makeContext = ({ lookups, labels, isHiddenField, fieldOrder }) => {
  const labelFor = (key) => labels?.[key] || humanizeKey(key)
  const isHidden = isHiddenField || defaultIsHidden
  const order = Array.isArray(fieldOrder) ? fieldOrder : []
  const orderOf = (key) => { const index = order.indexOf(key); return index === -1 ? order.length : index }
  return {
    lookups: lookups || {},
    labelFor,
    isHidden,
    orderOf,
    format: (key, value) => formatSnapshotValue(key, value, { lookups: lookups || {}, labelFor, isHidden }),
  }
}

const visibleKeys = (ctx, ...objects) => [...new Set(objects.flatMap((object) => (isPlainObject(object) ? Object.keys(object) : [])))]
  .filter((key) => !ctx.isHidden(key))
  .map((key, index) => ({ key, index }))
  .sort((a, b) => ctx.orderOf(a.key) - ctx.orderOf(b.key) || a.index - b.index)
  .map(({ key }) => key)

const isRecordList = (value) => Array.isArray(value) && value.some(isPlainObject)

// Flattens nested objects into labelled rows, e.g. "Broker Details / Realty Name".
const flattenRows = (ctx, before, after, prefix = []) => {
  const rows = []
  for (const key of visibleKeys(ctx, before, after)) {
    const b = isPlainObject(before) ? before[key] : undefined
    const a = isPlainObject(after) ? after[key] : undefined
    if (isRecordList(b) || isRecordList(a)) {
      rows.push({ type: 'list', key, path: [...prefix, key], before: Array.isArray(b) ? b : [], after: Array.isArray(a) ? a : [] })
    } else if (isPlainObject(b) || isPlainObject(a)) {
      rows.push(...flattenRows(ctx, isPlainObject(b) ? b : {}, isPlainObject(a) ? a : {}, [...prefix, key]))
    } else {
      rows.push({ type: 'field', key, path: [...prefix, key], before: b, after: a })
    }
  }
  return rows
}

const pathLabel = (ctx, path) => {
  // Network-import summary has descriptive leaf labels. Avoid showing
  // 'Summary / Create' and similar internal implementation names.
  if (path[0] === 'summary' && ctx.labelFor('summary') === 'Import Summary') {
    return path.slice(1).map(ctx.labelFor).join(' / ') || 'Import Summary'
  }
  return path.map(ctx.labelFor).join(' / ')
}

const ValueCell = ({ ctx, field, value, tone }) => {
  const empty = isEmptyValue(value)
  const tones = { before: 'text-red-800 line-through decoration-red-300', after: 'text-emerald-900', plain: 'text-slate-800' }
  return <span className={`break-words text-sm font-bold ${empty ? 'font-semibold italic text-slate-400 no-underline' : tones[tone] || tones.plain}`}>{ctx.format(field, value)}</span>
}

const FieldTable = ({ ctx, rows, showUnchanged }) => {
  const visible = showUnchanged ? rows : rows.filter((row) => !sameValue(row.before, row.after))
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
          const changed = !sameValue(row.before, row.after)
          return <tr key={row.path.join('.')} className={changed ? 'bg-amber-50/40' : ''}>
            <td className="py-2.5 pr-3 align-top text-sm font-semibold text-slate-600">{pathLabel(ctx, row.path)}</td>
            <td className="py-2.5 pr-3 align-top"><ValueCell ctx={ctx} field={row.key} value={row.before} tone={changed ? 'before' : 'plain'} /></td>
            <td className="py-2.5 align-top"><ValueCell ctx={ctx} field={row.key} value={row.after} tone={changed ? 'after' : 'plain'} /></td>
          </tr>
        })}
      </tbody>
    </table>
  </div>
}

const recordTitle = (ctx, record, idKey, fallbackIndex) => {
  if (!record) return `Item ${fallbackIndex + 1}`
  if (idKey && record[idKey] != null) return ctx.format(idKey, record[idKey])
  const named = ['name', 'label', 'title', 'unitCode', 'email'].find((key) => record[key])
  return named ? String(record[named]) : `Item ${fallbackIndex + 1}`
}

const RecordListDiff = ({ ctx, row, showUnchanged }) => {
  const { idKey, entries } = matchSnapshotRecords(row.before, row.after)
  const shown = showUnchanged ? entries : entries.filter((entry) => entry.state !== 'unchanged')
  const hiddenCount = entries.length - shown.length
  if (!shown.length && !hiddenCount) return <p className="text-sm font-semibold italic text-slate-400">None</p>
  const ListContainer = shown.length > 10 ? 'details' : 'div'
  return <ListContainer className="grid gap-3">
    {shown.length > 10 ? <summary className="mb-3 cursor-pointer text-sm font-black text-blue-700">Show details for {shown.length} records</summary> : null}
    {shown.map((entry) => {
      const style = RECORD_STATE_STYLES[entry.state]
      const title = recordTitle(ctx, entry.after || entry.before, idKey, entry.index)
      const fields = flattenRows(ctx, entry.before || {}, entry.after || {}).filter((field) => field.type === 'field' && field.key !== idKey)
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
                  <dt className="text-sm font-semibold text-slate-500">{pathLabel(ctx, field.path)}</dt>
                  <dd className={`text-right text-sm font-bold ${entry.state === 'removed' ? 'text-red-800 line-through decoration-red-300' : 'text-emerald-900'}`}>{ctx.format(field.key, entry.state === 'removed' ? field.before : field.after)}</dd>
                </div>)}
              </dl>
            : <FieldTable ctx={ctx} rows={fields} showUnchanged={showUnchanged} />}
        </div>
      </div>
    })}
    {hiddenCount ? <p className="text-xs font-semibold text-slate-500">{hiddenCount} other {hiddenCount === 1 ? 'entry is' : 'entries are'} unchanged.</p> : null}
  </ListContainer>
}

/**
 * mode="changes": only what changed. mode="full": every field of both snapshots.
 * listRenderers: { [fieldKey]: Component } for record lists that need their own
 * card (receives before, after, lookups, showUnchanged).
 */
const ReviewSnapshotDiff = ({ beforeValue, afterValue, lookups = {}, mode = 'changes', labels = {}, isHiddenField, fieldOrder = [], listRenderers = {} }) => {
  const ctx = makeContext({ lookups, labels, isHiddenField, fieldOrder })
  const before = parseSnapshotValue(beforeValue) || {}
  const after = parseSnapshotValue(afterValue) || {}
  const showUnchanged = mode === 'full'
  const rows = flattenRows(ctx, before, after)
  const fieldRows = rows.filter((row) => row.type === 'field')
  const listRows = rows.filter((row) => row.type === 'list' && (showUnchanged || !sameValue(row.before, row.after)))
  const changedFieldCount = fieldRows.filter((row) => !sameValue(row.before, row.after)).length
  const isNewRecord = !parseSnapshotValue(beforeValue)

  if (!showUnchanged && !changedFieldCount && !listRows.length) {
    return <p className="text-sm font-semibold text-amber-800">No differences were captured in this review snapshot. This does not prove the record was unchanged; check the full record and Audit Logs for details.</p>
  }

  return <div className="grid gap-5">
    {isNewRecord && !showUnchanged ? <p className="text-sm font-semibold text-slate-500">This record was newly created, so there are no earlier values.</p> : null}
    {(showUnchanged ? fieldRows.length : changedFieldCount) ? <FieldTable ctx={ctx} rows={fieldRows} showUnchanged={showUnchanged} /> : null}
    {listRows.map((row) => {
      const Custom = listRenderers[row.key]
      return <div key={row.path.join('.')} className="grid gap-2">
        <p className="text-sm font-black text-slate-800">{pathLabel(ctx, row.path)}</p>
        {Custom
          ? <Custom before={row.before} after={row.after} lookups={ctx.lookups} showUnchanged={showUnchanged} />
          : <RecordListDiff ctx={ctx} row={row} showUnchanged={showUnchanged} />}
      </div>
    })}
  </div>
}

export default ReviewSnapshotDiff



