const styles = {
  available: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  limited: 'border-amber-200 bg-amber-50 text-amber-800',
  full: 'border-rose-200 bg-rose-50 text-rose-800',
  closed: 'border-slate-200 bg-slate-100 text-slate-600',
  hiring: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  interest: 'border-[#dfd2aa] bg-[#faf4e4] text-[#745710]',
}

const StatusBadge = ({ value, children }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${styles[value] || styles.interest}`}>
    {children}
  </span>
)

export default StatusBadge
