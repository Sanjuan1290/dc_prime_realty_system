import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiEdit3,
  FiEye,
  FiFileText,
  FiGrid,
  FiHome,
  FiPrinter,
  FiRefreshCw,
  FiShield,
  FiX,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ProjectDetailsModal from '../../components/Lot_Projects/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal'
import EditProjectModal from '../../components/Lot_Projects/DashboardComponents/EditProjectModal/EditProjectModal'
import { useFetch, useFetchPost, useFetchPut, getDoubleCheckNotice } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

const number = (value) => new Intl.NumberFormat('en-PH').format(Number(value || 0))

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const MetricCard = ({ label, value, helper, icon: Icon, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          {helper ? <p className="mt-2 text-sm font-semibold text-slate-500">{helper}</p> : null}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tones[tone] || tones.blue}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

const AttentionCard = ({ label, value, helper, tone = 'amber' }) => {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    red: 'border-red-200 bg-red-50 text-red-950',
    blue: 'border-blue-200 bg-blue-50 text-blue-950',
  }

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.amber}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-70">{helper}</p>
    </div>
  )
}

const statusClasses = (status = '') => {
  const value = String(status || '').toLowerCase()
  if (value.includes('fully paid') || value === 'available') return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (value.includes('pending') || value.includes('hold')) return 'bg-amber-50 text-amber-700 ring-amber-100'
  if (value.includes('cancel')) return 'bg-red-50 text-red-700 ring-red-100'
  return 'bg-blue-50 text-blue-700 ring-blue-100'
}

const toProjectView = (project = {}) => ({
  ...project,
  project_bailen_id: project.lot_project_id || project.id,
  project_bailen_storage_code: project.lot_project_storage_code || project.storageCode || project.storage_code || null,
  project_bailen_name: project.lot_project_name || project.name,
  project_bailen_location: project.lot_project_location || project.location,
  project_bailen_location_code: project.lot_project_location_code || project.locationCode,
  project_bailen_administrator_name: project.lot_project_administrator_name || project.administrator,
  project_bailen_tax_declaration_no: project.lot_project_tax_declaration_no || project.taxDeclarationNo,
  project_bailen_title_number: project.lot_project_title_number || project.titleNumber,
  project_bailen_pin: project.lot_project_pin || project.pin,
  project_bailen_status: project.lot_project_status || project.status,
  project_bailen_document_template: 'Project Default Documents',
  project_bailen_default_documents: project.defaultDocuments?.length || 0,
  project_bailen_required_documents: project.defaultDocuments?.filter((document) => document.requirement === 'required' || document.lot_project_default_document_is_required).length || 0,
  project_bailen_optional_documents: project.defaultDocuments?.filter((document) => document.requirement === 'optional' || document.lot_project_default_document_is_required === 0).length || 0,
  project_bailen_created_at: project.lot_project_created_at || project.created_at,
  project_bailen_updated_at: project.lot_project_updated_at || project.updated_at,
  listingCount: Number(project.listingCount ?? project.listing_count ?? 0),
  cadastral_lots: (project.cadastralLotDetails || project.cadastral_lot_details || project.cadastralLots || project.cadastral_lots || []).map((lot) => ({
    id: lot.id || lot.lot_project_cadastral_lot_number_id || lot.lotNumber || lot,
    lotNumber: lot.lotNumber || lot.lot_project_cadastral_lot_number || lot,
    status: lot.status || 'active',
    usedCount: Number(lot.usedCount || 0),
  })),
})


const DEFAULT_STRAIGHT_PAYMENT_MONTHS = 20

const PRICE_LIST_STATUS_OPTIONS = [
  { value: 'available', label: 'Available Only' },
  { value: 'all', label: 'All Statuses' },
  { value: 'hold', label: 'Hold' },
  { value: 'sold', label: 'Sold / Active' },
  { value: 'fully_paid', label: 'Fully Paid' },
  { value: 'pending_for_cancellation', label: 'Pending Cancellation' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PriceListPrintModal = ({ projectName, onClose, onPrint }) => {
  const [months, setMonths] = useState(String(DEFAULT_STRAIGHT_PAYMENT_MONTHS))
  const [status, setStatus] = useState('available')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const parsedMonths = Number(months)

    if (!Number.isInteger(parsedMonths) || parsedMonths < 1 || parsedMonths > 120) {
      setErrorMessage('Straight Payment (Months) must be a whole number from 1 to 120.')
      return
    }

    onPrint(parsedMonths, status)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">Print Price List</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Choose which units to include and set the straight-payment term for {projectName || 'this project'}.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100" aria-label="Close price list settings">
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-5 p-5">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">Unit Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
              {PRICE_LIST_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="text-xs font-semibold text-slate-500">Choose available inventory only, all units, or one specific unit status. Buyer information is never included in the price list.</span>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">Straight Payment (Months)</span>
            <input
              type="number"
              min="1"
              max="120"
              step="1"
              data-example="20 months"
              value={months}
              onChange={(event) => { setMonths(event.target.value); setErrorMessage('') }}
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
            <span className="text-xs font-semibold text-slate-500">The printed monthly amount uses the installment selling price without LMF, less the reservation fee, divided by this month count.</span>
          </label>

          {errorMessage ? <StatusAlert type="error" message={errorMessage} className="mt-4" /> : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-100">Cancel</button>
          <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700"><FiPrinter /> Print Price List</button>
        </footer>
      </form>
    </div>
  )
}


const Dashboard = () => {
  const { projectSlug } = useParams()
  const basePath = `/portal/lot-projects/${projectSlug}`
  const queryClient = useQueryClient()
  const [showDetails, setShowDetails] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showPriceListModal, setShowPriceListModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['lot-dashboard', projectSlug, 'operational'],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/dashboard?range=this_month`),
    enabled: Boolean(projectSlug),
    refetchOnWindowFocus: true,
  })

  const payload = data?.data || {}
  const project = useMemo(() => toProjectView(payload.project || {}), [data])
  const stats = payload.stats || {}
  const recentUnits = payload.recentUnits || []
  const upcomingDues = payload.upcomingDues || []
  const projectName = project.project_bailen_name || project.lot_project_name || project.name || 'Lot Project'

  const { data: documentsData, isLoading: isDocumentsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => useFetch('/documents/getDocuments'),
  })

  const { data: templatesData, isLoading: isTemplatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => useFetch('/documents/getTemplates'),
  })

  const updateProjectMutation = useMutation({
    mutationFn: ({ payload: updatePayload, reviewData }) => useFetchPut(`/projects/lot-projects/${project.project_bailen_id}`, updatePayload, {
      doubleCheck: { type: 'project', mode: 'edit', data: reviewData },
    }),
    onMutate: () => setAlert({ type: 'loading', message: 'Preparing project review...' }),
    onSuccess: (result) => {
      setShowEdit(false)
      setAlert({ type: 'success', message: result?.message || 'Project updated successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-project', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-project-options'] })
      queryClient.invalidateQueries({ queryKey: ['lot-projects'] })
    },
    onError: (mutationError) => {
      setAlert(getDoubleCheckNotice(mutationError, 'Failed to save project changes.'))
    },
  })

  const handleSaveProject = (updatePayload, reviewData) => updateProjectMutation.mutateAsync({ payload: updatePayload, reviewData })

  const handlePrintPriceList = async (straightPaymentMonths, status = 'available') => {
    const printWindow = window.open('about:blank', '_blank')
    if (printWindow) printWindow.opener = null
    try {
      await useFetchPost(`/projects/lot-projects/${projectSlug}/price-list/print-audit`, { straightPaymentMonths, status }, { confirmationHandled: 'technical' })
      const params = new URLSearchParams({ straightPaymentMonths: String(straightPaymentMonths), status })
      const printUrl = `/portal/lot-projects/${projectSlug}/price-list/print?${params.toString()}`
      if (printWindow) printWindow.location.replace(printUrl)
      else window.open(printUrl, '_blank', 'noopener,noreferrer')
      setShowPriceListModal(false)
    } catch (printError) {
      try { printWindow?.close() } catch {}
      setAlert({ type: 'error', message: printError?.message || 'Unable to prepare the price list.' })
    }
  }

  const attentionUnits = useMemo(() => recentUnits.filter((row) => (
    Number(row.overdueCount || 0) > 0
    || row.documentsComplete === false
    || String(row.status || '').toLowerCase().includes('pending')
  )).slice(0, 8), [recentUnits])

  const missingDocumentUnits = useMemo(
    () => recentUnits.filter((row) => row.documentsComplete === false).length,
    [recentUnits]
  )

  const operationalStats = [
    { label: 'Total Units', value: isLoading ? '...' : number(stats.totalUnits), helper: 'All units currently encoded in this project.', icon: FiGrid, tone: 'blue' },
    { label: 'Available', value: isLoading ? '...' : number(stats.available), helper: 'Units currently available for reservation.', icon: FiCheckCircle, tone: 'green' },
    { label: 'On Hold', value: isLoading ? '...' : number(stats.hold), helper: 'Units temporarily held from availability.', icon: FiClock, tone: 'amber' },
    { label: 'Sold / Active', value: isLoading ? '...' : number(stats.soldActive), helper: 'Active buyer accounts that are not yet fully paid.', icon: FiDollarSign, tone: 'indigo' },
    { label: 'Fully Paid', value: isLoading ? '...' : number(stats.fullyPaid), helper: 'Buyer accounts completed in full.', icon: FiCheckCircle, tone: 'green' },
    { label: 'Pending Cancellation', value: isLoading ? '...' : number(stats.pendingCancellation), helper: 'Current accounts awaiting cancellation resolution.', icon: FiAlertTriangle, tone: 'red' },
  ]

  const quickLinks = [
    { label: 'Reports', helper: 'Sales, collections, trends and analytics.', path: `${basePath}/reports`, icon: FiHome },
    { label: 'Listings / Units', helper: 'Open inventory and buyer account records.', path: `${basePath}/listings`, icon: FiGrid },
    { label: 'Payments Audit', helper: 'Review recorded payment activity.', path: `${basePath}/payments-audit`, icon: FiShield },
    { label: 'Commissions', helper: 'Review commission eligibility and releases.', path: `${basePath}/commissions`, icon: FiDollarSign },
  ]

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title={`${projectName} Dashboard`}
          description="Current project operations, items needing attention, upcoming dues, and recent unit activity."
          icon={FiHome}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowDetails(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"><FiEye className="h-4 w-4" />View Details</button>
          <button type="button" onClick={() => setShowEdit(true)} disabled={isDocumentsLoading || isTemplatesLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"><FiEdit3 className="h-4 w-4" />Edit Project</button>
          <button type="button" onClick={() => setShowPriceListModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"><FiPrinter className="h-4 w-4" />Price List</button>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading project dashboard..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing operational data..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load project dashboard.'} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {operationalStats.map((item) => <MetricCard key={item.label} {...item} />)}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-black text-slate-950">Needs Attention</h2>
          <p className="text-sm font-semibold text-slate-500">Current operational items that may need follow-up.</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <AttentionCard label="Overdue Schedules" value={isLoading ? '...' : number(stats.overdueCount)} helper="Payment schedules currently overdue." tone="red" />
          <AttentionCard label="Due Soon" value={isLoading ? '...' : number(stats.dueSoonCount)} helper="Upcoming payment schedules flagged by the dashboard." tone="amber" />
          <AttentionCard label="Recent Units Missing Documents" value={isLoading ? '...' : number(missingDocumentUnits)} helper="Based on the latest unit records returned by the project dashboard." tone="blue" />
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[900px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Unit', 'Buyer', 'Issue', 'Status', 'Action'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!isLoading && attentionUnits.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center font-semibold text-slate-500">No attention items found in the recent unit records.</td></tr>
              ) : null}
              {attentionUnits.map((row) => {
                const issues = []
                if (Number(row.overdueCount || 0) > 0) issues.push(`${number(row.overdueCount)} overdue`)
                if (row.documentsComplete === false) issues.push(`${number(row.missingRequiredDocumentCount || 0)} document(s) missing`)
                if (String(row.status || '').toLowerCase().includes('pending')) issues.push('Pending status')
                return (
                  <tr key={row.id || row.unitCode} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-black text-slate-950">{row.unitCode || '-'}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{row.buyer || '-'}</td>
                    <td className="px-4 py-4 font-semibold text-amber-700">{issues.join(' · ') || '-'}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClasses(row.status)}`}>{row.status || '-'}</span></td>
                    <td className="px-4 py-4">
                      {row.id ? <Link to={`${basePath}/listings/${row.id}`} className="font-black text-blue-700 hover:text-blue-900">Open Unit</Link> : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-black text-slate-950">Upcoming Dues</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Next payment obligations returned by the project dashboard.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50"><tr>{['Unit', 'Buyer', 'Due Date', 'Balance Due'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {!isLoading && upcomingDues.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center font-semibold text-slate-500">No upcoming dues found.</td></tr> : null}
                {upcomingDues.slice(0, 8).map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-black text-slate-950">{row.unit || '-'}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{row.buyer || '-'}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{formatDate(row.dueDate)}</td>
                    <td className="px-4 py-4 font-black text-amber-700">{money(row.balanceDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Quick Navigation</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Open the project area you need without going through the sidebar.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {quickLinks.map(({ label, helper, path, icon: Icon }) => (
              <Link key={label} to={path} className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950 group-hover:text-blue-950">{label}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 group-hover:text-blue-700">{helper}</p>
                  </div>
                  <Icon className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-blue-600" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <FiFileText className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <div>
                <p className="font-black text-blue-950">Financial analytics moved to Reports</p>
                <p className="mt-1 text-sm font-semibold text-blue-800">Sales, collections, penalties, cancellations, inventory values, seller performance, commissions, and charts are now under the Reports tab.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showPriceListModal ? <PriceListPrintModal projectName={project.project_bailen_name} onClose={() => setShowPriceListModal(false)} onPrint={handlePrintPriceList} /> : null}
      {showDetails ? <ProjectDetailsModal project={project} onClose={() => setShowDetails(false)} onEdit={() => { setShowDetails(false); setShowEdit(true) }} onPrintPriceList={() => { setShowDetails(false); setShowPriceListModal(true) }} /> : null}
      {showEdit ? <EditProjectModal project={project} documents={documentsData?.documents || []} templates={templatesData?.templates || []} templateDocuments={templatesData?.template_documents || []} onClose={() => setShowEdit(false)} onSave={handleSaveProject} isSaving={updateProjectMutation.isPending} /> : null}
    </main>
  )
}

export default Dashboard
