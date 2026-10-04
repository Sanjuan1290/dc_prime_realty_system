const PermissionMatrix = ({ catalog = [], selected = [], onChange, disabled = false }) => {
  const selectedSet = new Set(selected || [])
  const allKeys = catalog.flatMap((group) => (group.items || []).map(([, key]) => key))

  const commit = (next) => onChange?.([...next])

  const toggle = (key) => {
    if (disabled) return
    const next = new Set(selectedSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    commit(next)
  }

  const toggleGroup = (group) => {
    if (disabled) return
    const keys = (group.items || []).map(([, key]) => key)
    const allSelected = keys.length > 0 && keys.every((key) => selectedSet.has(key))
    const next = new Set(selectedSet)
    keys.forEach((key) => allSelected ? next.delete(key) : next.add(key))
    commit(next)
  }

  const selectAll = () => {
    if (!disabled) commit(new Set(allKeys))
  }

  const clearAll = () => {
    if (!disabled) commit(new Set())
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={selectAll} disabled={disabled} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50">Select All</button>
        <button type="button" onClick={clearAll} disabled={disabled} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50">Clear</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {catalog.map((group) => {
          const groupKeys = (group.items || []).map(([, key]) => key)
          const selectedCount = groupKeys.filter((key) => selectedSet.has(key)).length
          const allSelected = groupKeys.length > 0 && selectedCount === groupKeys.length
          return (
            <section key={group.group} className="rounded-2xl border border-slate-200 bg-white p-4">
              <label className={`flex items-center gap-3 ${disabled ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-900'}`}>
                <input type="checkbox" checked={allSelected} disabled={disabled} onChange={() => toggleGroup(group)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="font-black">{group.group}</span>
                <span className="ml-auto text-xs font-bold text-slate-400">{selectedCount}/{groupKeys.length}</span>
              </label>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(group.items || []).map((item) => {
                  const [label, key] = item
                  return (
                    <label key={key} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : 'cursor-pointer hover:border-blue-200 hover:bg-blue-50'}`}>
                      <input type="checkbox" checked={selectedSet.has(key)} disabled={disabled} onChange={() => toggle(key)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600" />
                      <span className="font-semibold">{label}</span>
                    </label>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export default PermissionMatrix
