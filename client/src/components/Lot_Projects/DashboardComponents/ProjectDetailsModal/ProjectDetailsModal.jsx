import { FiEdit3, FiPrinter, FiX } from 'react-icons/fi'

const DetailItem = ({ label, value, wide = false }) => (
  <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 ${wide ? 'md:col-span-2' : ''}`}>
    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-black text-slate-950">{value || '-'}</p>
  </div>
)

const LotBadge = ({ lot }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3">
    <div className="flex items-center justify-between gap-3">
      <p className="font-black text-slate-950">{lot.lotNumber}</p>
      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${lot.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{lot.status}</span>
    </div>
    <p className="mt-2 text-xs font-semibold text-slate-500">{lot.usedCount ? `Used by ${lot.usedByUnits}` : 'Not linked to any unit yet'}</p>
  </div>
)

const ProjectDetailsModal = ({ project, onClose, onEdit }) => {
  const lots = project.cadastral_lots || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{project.project_bailen_name || 'Lot Project'}</p><h2 className="mt-1 text-xl font-black text-slate-950">Project Details</h2><p className="mt-1 text-sm font-semibold text-slate-500">Database project profile and lot references.</p></div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Close project details"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailItem label="Project ID" value={project.project_bailen_id} />
            <DetailItem label="Project Name" value={project.project_bailen_name} />
            <DetailItem label="Location" value={project.project_bailen_location} />
            <DetailItem label="Location Code" value={project.project_bailen_location_code} />
            <DetailItem label="Administrator" value={project.project_bailen_administrator_name} />
            <DetailItem label="Tax Declaration No." value={project.project_bailen_tax_declaration_no} />
            <DetailItem label="PIN" value={project.project_bailen_pin} />
            <DetailItem label="Status" value={project.project_bailen_status} />
            <DetailItem label="Document Template" value={project.project_bailen_document_template} />
            <DetailItem label="Required Documents" value={project.project_bailen_required_documents} />
            <DetailItem label="Created At" value={project.project_bailen_created_at} />
            <DetailItem label="Updated At" value={project.project_bailen_updated_at} />
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-lg font-black text-slate-950">Cadastral Lot Numbers</h3><p className="text-sm font-semibold text-slate-500">Lots already used by listings remain visible for audit and unit references.</p></div><p className="text-sm font-black text-slate-600">{lots.length} total</p></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">{lots.length ? lots.map((lot) => <LotBadge key={lot.id || lot.lotNumber} lot={lot} />) : <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500 md:col-span-2">No cadastral lots saved yet.</p>}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiPrinter className="h-4 w-4" />Print Price List</button>
          <button type="button" onClick={onEdit} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"><FiEdit3 className="h-4 w-4" />Edit Project</button>
        </div>
      </div>
    </div>
  )
}

export default ProjectDetailsModal
