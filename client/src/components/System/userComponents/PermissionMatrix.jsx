const PermissionMatrix = ({ catalog = [], selected = [], onChange, disabled = false }) => {
  const selectedSet = new Set(selected || [])
  const toggle = (key) => {
    if (disabled) return
    const next = new Set(selectedSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange?.([...next])
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {catalog.map((group) => (
        <section key={group.group} className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="font-black text-slate-900">{group.group}</h4>
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
      ))}
    </div>
  )
}

export default PermissionMatrix
