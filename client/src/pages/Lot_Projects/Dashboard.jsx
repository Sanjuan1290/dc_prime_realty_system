import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiActivity, FiEdit3, FiEye, FiGrid, FiMapPin, FiPrinter, FiRefreshCw, FiTrendingUp } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ProjectDetailsModal from '../../components/Lot_Projects/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal'
import EditProjectModal from '../../components/Lot_Projects/DashboardComponents/EditProjectModal/EditProjectModal'
import { useFetch, useFetchPut } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))

const Badge = ({ children, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${tones[tone] || tones.blue}`}>{children}</span>
}

const toProjectView = (project = {}) => ({
  ...project,
  project_bailen_id: project.lot_project_id || project.id,
  project_bailen_name: project.lot_project_name || project.name,
  project_bailen_location: project.lot_project_location || project.location,
  project_bailen_location_code: project.lot_project_location_code || project.locationCode,
  project_bailen_administrator_name: project.lot_project_administrator_name || project.administrator,
  project_bailen_tax_declaration_no: project.lot_project_tax_declaration_no || project.taxDeclarationNo,
  project_bailen_pin: project.lot_project_pin || project.pin,
  project_bailen_status: project.lot_project_status || project.status,
  project_bailen_document_template: 'Project Default Documents',
  project_bailen_default_documents: project.defaultDocuments?.length || 0,
  project_bailen_required_documents: project.defaultDocuments?.filter((document) => document.requirement === 'required' || document.lot_project_default_document_is_required).length || 0,
  project_bailen_optional_documents: project.defaultDocuments?.filter((document) => document.requirement === 'optional' || document.lot_project_default_document_is_required === 0).length || 0,
  project_bailen_created_at: project.lot_project_created_at || project.created_at,
  project_bailen_updated_at: project.lot_project_updated_at || project.updated_at,
  cadastral_lots: (project.cadastralLots || project.cadastral_lots || []).map((lot) => ({
    id: lot.id || lot.lot_project_cadastral_lot_number_id || lot.lotNumber || lot,
    lotNumber: lot.lotNumber || lot.lot_project_cadastral_lot_number || lot,
    status: lot.status || 'active',
    usedCount: Number(lot.usedCount || 0),
    usedByUnits: lot.usedByUnits || '',
  })),
})

const Dashboard = () => {
  const { projectSlug } = useParams()
  const queryClient = useQueryClient()
  const [showDetails, setShowDetails] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [alert, setAlert] = useState(null)

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['lot-dashboard', projectSlug],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/dashboard`),
    enabled: Boolean(projectSlug),
  })

  const { data: documentsData, isLoading: isDocumentsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => useFetch('/documents/getDocuments'),
  })

  const { data: templatesData, isLoading: isTemplatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => useFetch('/documents/getTemplates'),
  })

  const project = useMemo(() => toProjectView(data?.data?.project || {}), [data])
  const recentUnits = data?.data?.recentUnits || []
  const dashboardStats = data?.data?.stats || {}

  const updateProjectMutation = useMutation({
    mutationFn: (payload) => useFetchPut(`/projects/lot-projects/${project.project_bailen_id}`, payload),
    onMutate: () => {
      setAlert({ type: 'loading', message: 'Saving project changes...' })
    },
    onSuccess: (result) => {
      setShowEdit(false)
      setAlert({ type: 'success', message: result?.message || 'Project updated successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-project', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-project-options'] })
      queryClient.invalidateQueries({ queryKey: ['lot-projects'] })
    },
    onError: (mutationError) => {
      setAlert({ type: 'error', message: mutationError?.message || 'Failed to save project changes.' })
    },
  })

  const stats = [
    { label: 'Total Units', value: isLoading ? '...' : dashboardStats.totalUnits || 0, helper: 'All project records', icon: FiGrid },
    { label: 'Available', value: isLoading ? '...' : dashboardStats.available || 0, helper: 'Ready for reservation', icon: FiActivity },
    { label: 'Sold / Active', value: isLoading ? '...' : dashboardStats.soldActive || 0, helper: 'With buyer accounts', icon: FiTrendingUp },
    { label: 'Gross Commission', value: isLoading ? '...' : money(dashboardStats.grossCommission || 0), helper: 'Estimated from listed TCP', icon: FiMapPin },
  ]

  const handleSaveProject = (updatedProject) => {
    updateProjectMutation.mutate(updatedProject)
  }

  const handleRefresh = () => {
    setAlert({ type: 'info', message: 'Refreshing project dashboard...' })
    queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
  }

  const handlePrintPriceList = () => {
    setAlert({ type: 'info', message: 'Price list printing will be connected after the listings printout module.' })
  }

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title={`${project.project_bailen_name || 'Lot Project'} Dashboard`} description="Project overview, unit activity, documents, and project controls." icon={FiMapPin} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setShowDetails(true)} disabled={isLoading || isError} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"><FiEye className="h-4 w-4" />View Details</button>
          <button type="button" onClick={() => setShowEdit(true)} disabled={isLoading || isError || isDocumentsLoading || isTemplatesLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><FiEdit3 className="h-4 w-4" />Edit Project</button>
          <button type="button" onClick={handlePrintPriceList} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"><FiPrinter className="h-4 w-4" />Price List</button>
        </div>
      </section>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading project dashboard..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing dashboard data..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load project dashboard.'} /> : null}

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
            <div><h2 className="text-lg font-black text-slate-950">Recent Unit Records</h2><p className="text-sm font-semibold text-slate-500">Latest project activity from database.</p></div>
            <button type="button" onClick={handleRefresh} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50"><tr>{['Unit','Buyer','TCP','Collection','Documents','Status'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">{head}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan={6} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">Loading recent units...</td></tr> : null}
                {!isLoading && recentUnits.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No recent unit records yet.</td></tr> : null}
                {!isLoading && recentUnits.map((row) => <tr key={row.id || row.unitCode} className="transition hover:bg-slate-50"><td className="px-5 py-4 font-black text-slate-950">{row.unitCode}</td><td className="px-5 py-4 font-semibold text-slate-700">{row.buyer}</td><td className="px-5 py-4 font-black text-slate-900">{money(row.tcp)}</td><td className="px-5 py-4 font-semibold text-slate-700">{row.progress || '0%'}</td><td className="px-5 py-4 font-semibold text-slate-600">{row.documents || row.documentStatus}</td><td className="px-5 py-4"><Badge tone={row.status === 'Fully Paid' ? 'green' : row.status?.includes('Pending') ? 'amber' : 'blue'}>{row.status}</Badge></td></tr>)}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Project Details</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Project Name</p><p className="mt-1 font-black text-slate-950">{project.project_bailen_name || '-'}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Location</p><p className="mt-1 font-black text-slate-950">{project.project_bailen_location || '-'}</p></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-400">Cadastral Lots</p><p className="mt-1 font-black text-slate-950">{project.cadastral_lots?.filter((lot) => lot.status === 'active').length || 0} active</p></div>
            </div>
          </div>
          <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5"><p className="text-sm font-black text-blue-900">Database-connected mode</p><p className="mt-2 text-sm font-semibold text-blue-800">This workspace now reads dashboard stats, recent units, project details, and default documents from the backend.</p></div>
        </aside>
      </section>

      {showDetails ? <ProjectDetailsModal project={project} onClose={() => setShowDetails(false)} onEdit={() => { setShowDetails(false); setShowEdit(true) }} /> : null}
      {showEdit ? <EditProjectModal project={project} documents={documentsData?.documents || []} templates={templatesData?.templates || []} templateDocuments={templatesData?.template_documents || []} onClose={() => setShowEdit(false)} onSave={handleSaveProject} isSaving={updateProjectMutation.isPending} /> : null}
    </main>
  )
}

export default Dashboard
