import { useState } from 'react'
import { FiActivity, FiEdit3, FiEye, FiGrid, FiMapPin, FiPrinter, FiRefreshCw, FiTrendingUp } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ProjectDetailsModal from '../../components/BailenProject/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal'
import EditProjectModal from '../../components/BailenProject/DashboardComponents/EditProjectModal/EditProjectModal'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))

const projectMock = {
  project_bailen_id: 1,
  project_bailen_name: 'Bailen Project',
  project_bailen_location: 'Bailen, Cavite',
  project_bailen_location_code: 'LA',
  project_bailen_administrator_name: 'IMELDA B. VILLALOBOS',
  project_bailen_tax_declaration_no: 'AA-06-0005-00105',
  project_bailen_pin: '022-06-0005-003-04',
  project_bailen_status: 'active',
  project_bailen_document_template: 'Required for Submission',
  project_bailen_default_documents: 10,
  project_bailen_required_documents: 9,
  project_bailen_optional_documents: 1,
  project_bailen_created_at: '2026-07-03',
  project_bailen_updated_at: '2026-07-03',
  project_bailen_ended_at: null,
  cadastral_lots: [
    { id: 1, lotNumber: 'CAD-001', status: 'active', usedCount: 1, usedByUnits: 'LA-0402' },
    { id: 2, lotNumber: 'CAD-002', status: 'active', usedCount: 1, usedByUnits: 'LA-0402' },
    { id: 3, lotNumber: 'CAD-003', status: 'active', usedCount: 0, usedByUnits: '' },
    { id: 4, lotNumber: 'CAD-004', status: 'inactive', usedCount: 1, usedByUnits: 'LA-0404' },
  ],
}

const stats = [
  { label: 'Total Units', value: 7, helper: 'All Bailen records', icon: FiGrid },
  { label: 'Available', value: 2, helper: 'Ready for reservation', icon: FiActivity },
  { label: 'Sold / Active', value: 2, helper: 'With buyer accounts', icon: FiTrendingUp },
  { label: 'Gross Commission', value: money(212918.4), helper: 'Mock commission total', icon: FiMapPin },
]

const recentUnits = [
  { unitCode: 'LA-0402', buyer: 'Robert San Juan', tcp: 1008000, progress: '17.25%', status: 'Sold / Active', documents: '9 / 10 approved' },
  { unitCode: 'LA-0501', buyer: 'Nico & Angela Reyes', tcp: 772200, progress: '100%', status: 'Fully Paid', documents: '9 / 10 approved' },
  { unitCode: 'LA-0502', buyer: 'Mika Fernandez', tcp: 881280, progress: '12.48%', status: 'Pending Cancellation', documents: '3 / 10 submitted' },
]

const Badge = ({ children, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${tones[tone] || tones.blue}`}>{children}</span>
}

const Dashboard = () => {
  const [project, setProject] = useState(projectMock)
  const [showDetails, setShowDetails] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [alert, setAlert] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveProject = (updatedProject) => {
    setIsSaving(true)
    setAlert({ type: 'loading', message: 'Saving project changes...' })
    window.setTimeout(() => {
      setProject((current) => ({ ...current, ...updatedProject, project_bailen_updated_at: '2026-07-03' }))
      setIsSaving(false)
      setShowEdit(false)
      setAlert({ type: 'success', message: 'Project updated in mock data.' })
    }, 700)
  }

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title="Bailen Dashboard" description="Mock project overview, unit activity, documents, and project controls." icon={FiMapPin} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setShowDetails(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"><FiEye className="h-4 w-4" />View Details</button>
          <button type="button" onClick={() => setShowEdit(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"><FiEdit3 className="h-4 w-4" />Edit Project</button>
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"><FiPrinter className="h-4 w-4" />Price List</button>
        </div>
      </section>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => { const Icon = item.icon; return (
          <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</p><p className="mt-3 text-2xl font-black text-slate-950">{item.value}</p><p className="mt-1 text-sm font-semibold text-slate-500">{item.helper}</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon className="h-6 w-6" /></div>
            </div>
          </div>
        )})}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div><h2 className="text-lg font-black text-slate-950">Recent Unit Records</h2><p className="text-sm font-semibold text-slate-500">Latest mock Bailen activity.</p></div>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiRefreshCw className="h-4 w-4" />Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50"><tr>{['Unit','Buyer','TCP','Collection','Documents','Status'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">{head}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {recentUnits.map((row) => <tr key={row.unitCode} className="transition hover:bg-slate-50"><td className="px-5 py-4 font-black text-slate-950">{row.unitCode}</td><td className="px-5 py-4 font-semibold text-slate-700">{row.buyer}</td><td className="px-5 py-4 font-black text-slate-900">{money(row.tcp)}</td><td className="px-5 py-4 font-semibold text-slate-700">{row.progress}</td><td className="px-5 py-4 font-semibold text-slate-600">{row.documents}</td><td className="px-5 py-4"><Badge tone={row.status === 'Fully Paid' ? 'green' : row.status.includes('Pending') ? 'amber' : 'blue'}>{row.status}</Badge></td></tr>)}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Project Details</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Project Name</p><p className="mt-1 font-black text-slate-950">{project.project_bailen_name}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Location</p><p className="mt-1 font-black text-slate-950">{project.project_bailen_location}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Cadastral Lots</p><p className="mt-1 font-black text-slate-950">{project.cadastral_lots.filter((lot) => lot.status === 'active').length} active</p></div>
            </div>
          </div>
          <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5"><p className="text-sm font-black text-blue-900">Design-only mode</p><p className="mt-2 text-sm font-semibold text-blue-800">This Bailen workspace uses mock data only. No backend, database, or upload connection.</p></div>
        </aside>
      </section>

      {showDetails ? <ProjectDetailsModal project={project} onClose={() => setShowDetails(false)} onEdit={() => { setShowDetails(false); setShowEdit(true) }} /> : null}
      {showEdit ? <EditProjectModal project={project} onClose={() => setShowEdit(false)} onSave={handleSaveProject} isSaving={isSaving} /> : null}
    </main>
  )
}

export default Dashboard
