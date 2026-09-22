import { FiExternalLink, FiFileText } from 'react-icons/fi'
import DoubleCheckFields from './DoubleCheckFields'

const DoubleCheckListCard = ({ title, subtitle = '', fields = [], index, total, previewUrl = '' }) => (
  <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <div className="flex min-w-0 items-center gap-2">
        <FiFileText className="h-4 w-4 shrink-0 text-blue-600" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">{title}</p>
          {subtitle ? <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {previewUrl ? (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-black text-blue-700 transition hover:bg-blue-100">
            <FiExternalLink className="h-3.5 w-3.5" /> Preview File
          </a>
        ) : null}
        {Number.isFinite(index) && Number.isFinite(total) ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">{index + 1}/{total}</span> : null}
      </div>
    </div>
    {fields.length ? <DoubleCheckFields fields={fields} /> : null}
  </article>
)

export default DoubleCheckListCard
