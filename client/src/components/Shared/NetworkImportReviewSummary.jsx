// A review is a historical record. Show only fields that were actually saved
// by the importer; never infer warning reasons or recalculate the stored counts.
const countOf = (value) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-PH', { maximumFractionDigits: 0 }) : '—'
const asCount = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

export default function NetworkImportReviewSummary({ after = {}, before = {} }) {
  const summary = after?.summary && typeof after.summary === 'object' ? after.summary : {}
  const imported = after?.importedCount ?? after?.processed?.length
  const cards = [
    { label: 'Members imported', value: imported },
    { label: 'New accounts created', value: summary.create },
    { label: 'Existing accounts updated', value: summary.update },
    { label: 'Members transferred', value: summary.transfer },
    { label: 'Spreadsheet rows', value: summary.total },
    { label: 'Rows with errors', value: summary.errors },
    { label: 'Import warnings', value: summary.warnings },
  ].filter(({ value }) => value !== undefined && value !== null)
  const warningDetails = [after?.warningDetails, after?.warnings, summary?.warningDetails]
    .flatMap((value) => Array.isArray(value) ? value : [])
    .map((value) => typeof value === 'string' ? value : (value?.message || value?.reason || ''))
    .filter(Boolean)
  const items = Array.isArray(after?.processed) ? after.processed : []
  const network = after?.networkName || before?.networkName || 'this Network'
  const errors = asCount(summary.errors)
  const warnings = asCount(summary.warnings)

  return <div className="mb-5 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/40">
    <div className="border-b border-blue-100 px-4 py-3">
      <p className="font-black text-slate-900">Network member import summary</p>
      <p className="mt-1 text-sm text-slate-600">{countOf(imported)} member(s) imported into {network}. These figures are counts of people or spreadsheet rows, not money.</p>
    </div>
    <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value }) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        <p className="mt-1 text-xl font-black tabular-nums text-slate-900">{countOf(value)}</p>
      </div>)}
    </div>
    {summary.ready != null ? <p className="px-4 pb-2 text-xs font-semibold text-slate-600">Rows validated and ready during import: {countOf(summary.ready)}.</p> : null}
    {errors > 0 ? <p className="px-4 pb-2 text-sm font-semibold text-red-700">{countOf(errors)} row(s) had import errors. Check the original spreadsheet or import report for specifics.</p> : null}
    {warnings > 0 ? <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-bold">{countOf(warnings)} import warning(s) recorded.</p>
      {warningDetails.length ? <ul className="mt-1 list-inside list-disc">{warningDetails.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul>
        : <p className="mt-1">This historical review saved the warning count, but not the warning explanation. The original import report may contain more detail.</p>}
    </div> : null}
    {items.length > 0 ? <details className="border-t border-blue-100 bg-white px-4 py-3">
      <summary className="cursor-pointer text-sm font-bold text-blue-800">Show imported members ({items.length})</summary>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2">Spreadsheet row</th><th className="py-2">Member email</th><th className="py-2">Import action</th></tr></thead><tbody>{items.map((item, index) => <tr key={`${item?.email || index}-${index}`} className="border-b border-slate-100"><td className="py-2">{item?.row ?? '—'}</td><td className="break-all py-2">{item?.email || '—'}</td><td className="py-2">{{ create: 'Created', update: 'Updated', transfer: 'Transferred' }[item?.action] || 'Imported'}</td></tr>)}</tbody></table></div>
      {items.length === 100 ? <p className="mt-2 text-xs text-slate-500">The review stores up to the first 100 imported member details.</p> : null}
    </details> : null}
  </div>
}

