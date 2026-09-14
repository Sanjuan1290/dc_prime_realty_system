import { displayValue, isBlank } from './doubleCheckFormatters'

const DoubleCheckField = ({ label, value, formatter, tone = 'default', wide = false, helper = '' }) => {
  const formatted = formatter ? formatter(value) : displayValue(value)
  const blank = isBlank(value)
  const toneClass = blank
    ? 'border-slate-200 bg-slate-50'
    : tone === 'financial'
      ? 'border-amber-200 bg-amber-50/80'
      : tone === 'important'
        ? 'border-blue-200 bg-blue-50/70'
        : 'border-slate-200 bg-white'
  const labelClass = blank ? 'text-slate-400' : tone === 'financial' ? 'text-amber-700' : 'text-slate-500'

  return (
    <div className={`rounded-xl border px-4 py-3 ${wide ? 'md:col-span-2' : ''} ${toneClass}`}>
      <p className={`text-[10px] font-black uppercase tracking-[0.08em] ${labelClass}`}>{label}</p>
      <p className={`mt-1.5 break-words text-sm leading-5 ${blank ? 'font-bold italic text-slate-400' : 'font-black text-slate-950'}`}>{formatted}</p>
      {helper ? <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">{helper}</p> : null}
    </div>
  )
}

export default DoubleCheckField

