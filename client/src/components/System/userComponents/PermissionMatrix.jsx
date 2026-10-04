const tone = {
  required: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  inherited: 'border-blue-200 bg-blue-50 text-blue-900',
  forbidden: 'border-slate-200 bg-slate-100 text-slate-400',
  optional: 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50',
}

const PermissionMatrix = ({ catalog = [], selected = [], onChange, disabled = false, policy = null }) => {
  const selectedSet = new Set(selected || [])
  const required = new Set(policy?.required || [])
  const inherited = new Set(policy?.inherited || [])
  const ceiling = policy?.ceiling ? new Set(policy.ceiling) : null
  const allKeys = catalog.flatMap((group) => (group.items || []).map(([, key]) => key))

  const stateFor = (key) => {
    if (ceiling && !ceiling.has(key)) return 'forbidden'
    if (required.has(key)) return 'required'
    if (inherited.has(key)) return 'inherited'
    return 'optional'
  }
  const isLocked = (key) => disabled || stateFor(key) !== 'optional'
  const effectiveChecked = (key) => required.has(key) || inherited.has(key) || selectedSet.has(key)
  const optionalKeys = allKeys.filter((key) => stateFor(key) === 'optional')
  const commit = (next) => onChange?.([...next])

  const toggle = (key) => {
    if (isLocked(key)) return
    const next = new Set(selectedSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    commit(next)
  }

  const toggleGroup = (group) => {
    if (disabled) return
    const keys = (group.items || []).map(([, key]) => key).filter((key) => stateFor(key) === 'optional')
    const allSelected = keys.length > 0 && keys.every((key) => selectedSet.has(key))
    const next = new Set(selectedSet)
    keys.forEach((key) => allSelected ? next.delete(key) : next.add(key))
    commit(next)
  }

  return (
    <div className="grid gap-4">
      {!disabled ? <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wide">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">Required</span>
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">Inherited</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">Optional</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-400">Not Allowed</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => commit(new Set(optionalKeys))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Select All Optional</button>
          <button type="button" onClick={() => commit(new Set())} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Clear Optional</button>
        </div>
      </div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {catalog.map((group) => {
          const groupKeys = (group.items || []).map(([, key]) => key)
          const optional = groupKeys.filter((key) => stateFor(key) === 'optional')
          const allSelected = optional.length > 0 && optional.every((key) => selectedSet.has(key))
          return <section key={group.group} className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className={`flex items-center gap-3 ${disabled || !optional.length ? 'text-slate-500' : 'cursor-pointer text-slate-900'}`}>
              <input type="checkbox" checked={allSelected} disabled={disabled || !optional.length} onChange={() => toggleGroup(group)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
              <span className="font-black">{group.group}</span>
              {group.kind ? <span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{group.kind}</span> : null}
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(group.items || []).map(([label, key]) => {
                const state = stateFor(key)
                return <label key={key} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${tone[state]} ${isLocked(key) ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input type="checkbox" checked={effectiveChecked(key)} disabled={isLocked(key)} onChange={() => toggle(key)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600" />
                  <span><span className="font-semibold">{label}</span><span className="mt-1 block text-[10px] font-black uppercase tracking-wide opacity-70">{state === 'forbidden' ? 'Not allowed' : state}</span></span>
                </label>
              })}
            </div>
          </section>
        })}
      </div>
    </div>
  )
}

export default PermissionMatrix
