const DoubleCheckSection = ({ title, helper = '', children, tone = 'slate', badge = '' }) => {
  const tones = {
    slate: 'border-l-slate-400 bg-slate-50',
    blue: 'border-l-blue-500 bg-blue-50/60',
    emerald: 'border-l-emerald-500 bg-emerald-50/50',
    amber: 'border-l-amber-500 bg-amber-50/50',
    violet: 'border-l-violet-500 bg-violet-50/50',
    cyan: 'border-l-cyan-500 bg-cyan-50/50',
  }

  return (
    <section className={`overflow-hidden rounded-2xl border border-l-4 border-slate-200 bg-white shadow-sm ${tones[tone] || tones.slate}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-base font-black text-slate-950">{title}</h3>
          {helper ? <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{helper}</p> : null}
        </div>
        {badge ? <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-200">{badge}</span> : null}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

export default DoubleCheckSection

