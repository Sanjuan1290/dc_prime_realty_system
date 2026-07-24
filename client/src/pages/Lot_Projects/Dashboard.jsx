import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  FiActivity,
  FiAlertTriangle,
  FiGrid,
  FiLayers,
  FiEdit3,
  FiEye,
  FiMapPin,
  FiPrinter,
  FiRefreshCw,
  FiTrendingDown,
  FiTrendingUp,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ProjectDetailsModal from '../../components/Lot_Projects/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal'
import EditProjectModal from '../../components/Lot_Projects/DashboardComponents/EditProjectModal/EditProjectModal'
import { useFetch, useFetchPut } from '../../utils/useFetch'
import useCurrentUser from '../../utils/useCurrentUser'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))
const compactMoney = (value) => new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
const number = (value) => new Intl.NumberFormat('en-PH').format(Number(value || 0))

const chartColors = {
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  indigo: '#4f46e5',
  slate: '#475569',
  violet: '#7c3aed',
}

const dateRangeOptions = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '2_months', label: '2 Months' },
  { value: '3_months', label: '3 Months' },
  { value: '6_months', label: '6 Months' },
  { value: '12_months', label: '12 Months' },
  { value: 'custom', label: 'Custom' },
]

const padDatePart = (value) => String(value).padStart(2, '0')
const toDateInput = (date) => `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`

const parseDateInput = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

const exceedsTwelveMonths = (fromDate, toDate) => {
  const from = parseDateInput(fromDate)
  const to = parseDateInput(toDate)
  if (!from || !to || from > to) return false
  const maximumEnd = new Date(from.getFullYear() + 1, from.getMonth(), from.getDate())
  maximumEnd.setDate(maximumEnd.getDate() - 1)
  return to > maximumEnd
}

const resolvePresetDateRange = (range, today = new Date()) => {
  let start
  let end

  if (range === 'last_month') {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    end = new Date(today.getFullYear(), today.getMonth(), 0)
  } else {
    const monthCount = Number.parseInt(String(range).match(/^(\d+)_months$/)?.[1] || '1', 10)
    start = new Date(today.getFullYear(), today.getMonth() - Math.max(monthCount - 1, 0), 1)
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  }

  return { from: toDateInput(start), to: toDateInput(end) }
}

const defaultDateRange = () => resolvePresetDateRange('3_months')

const shortLabel = (value = '', max = 18) => {
  const text = String(value || '-')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const isMoneyChartKey = (dataKey = '') => {
  const key = String(dataKey || '')

  if (/count|entries|units|clients|projects|listings|collections/i.test(key)) {
    return false
  }

  return /totalSales|pendingSales|salesAmount|collected|discount|settled|inventory|commission|released|eligible|remaining|value|amount|gross|net/i.test(key)
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  const title = label || payload[0]?.name || ''

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {title ? <p className="font-black text-slate-900">{title}</p> : null}
      <div className="mt-2 grid gap-1.5">
        {payload.map((item, index) => {
          const isPeso = isMoneyChartKey(item.dataKey)
          const markerColor = item.color || item.fill || item.stroke || item.payload?.color || item.payload?.fill || item.payload?.payload?.color || '#94a3b8'
          return (
            <div key={`${item.dataKey}-${index}`} className="flex items-center gap-2 font-semibold text-slate-600">
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: markerColor }} />
              <span>{item.name}: <span className="font-black text-slate-950">{isPeso ? money(item.value) : number(item.value)}</span></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ChartCard = ({ title, description, children, footer }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div>
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {description ? <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p> : null}
    </div>
    <div className="mt-5 h-72">{children}</div>
    {footer ? <p className="mt-3 text-xs font-semibold text-slate-500">{footer}</p> : null}
  </div>
)

const EmptyChart = ({ message = 'No chart data yet.' }) => (
  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
    {message}
  </div>
)

const DateRangeFilter = ({ range, onRangeChange, dateFrom, setDateFrom, dateTo, setDateTo, isFetching, isAdmin1 }) => {
  const isCustom = range === 'custom'

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">Graph Date Filter</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Presets cover complete calendar months. Custom accepts exact dates. Financial cards and trend charts use the selected range.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Range</span>
            <select value={range} onChange={(event) => onRangeChange(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
              {dateRangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">From date</span>
            <input type="date" value={dateFrom} max={isCustom ? dateTo || undefined : undefined} onChange={(event) => setDateFrom(event.target.value)} disabled={!isCustom} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">To date</span>
            <input type="date" value={dateTo} min={isCustom ? dateFrom || undefined : undefined} onChange={(event) => setDateTo(event.target.value)} disabled={!isCustom} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" />
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
        {isAdmin1 ? <span>Admin 1 limit: up to 12 months (1 year).</span> : null}
        {isFetching ? <span className="text-blue-700">Updating dashboard data...</span> : null}
      </div>
    </section>
  )
}

const Badge = ({ children, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${tones[tone] || tones.blue}`}>{children}</span>
}

const PendingBalanceCell = ({ row }) => {
  if (!row.hasClientAccount || row.pendingBalance === null || row.pendingBalance === undefined) {
    return <Badge tone="slate">N/A</Badge>
  }

  const pendingBalance = Number(row.pendingBalance || 0)

  return pendingBalance > 0.009
    ? <span className="font-black text-amber-700">{money(pendingBalance)}</span>
    : <Badge tone="green">Paid</Badge>
}

const OverdueCell = ({ row }) => {
  if (!row.hasClientAccount) return <Badge tone="slate">N/A</Badge>

  const overdueCount = Number(row.overdueCount || 0)
  const overdueAmount = Number(row.overdueAmount || 0)

  if (overdueCount <= 0) return <Badge tone="green">Current</Badge>

  return (
    <div className="min-w-[120px]">
      <Badge tone="red">{overdueCount} overdue</Badge>
      <p className="mt-1 text-xs font-black text-red-700">{money(overdueAmount)}</p>
    </div>
  )
}

const DocumentsCell = ({ row }) => {
  if (!row.hasClientAccount || row.documentsComplete === null || row.documentsComplete === undefined) {
    return <Badge tone="slate">N/A</Badge>
  }

  const required = Number(row.requiredDocumentCount || 0)
  const completed = Number(row.completedRequiredDocumentCount || 0)
  const missing = Number(row.missingRequiredDocumentCount || 0)

  if (required <= 0) return <Badge tone="green">No required docs</Badge>

  if (row.documentsComplete) {
    return (
      <div className="min-w-[120px]">
        <Badge tone="green">Complete</Badge>
        <p className="mt-1 text-xs font-semibold text-slate-500">{completed}/{required} submitted</p>
      </div>
    )
  }

  return (
    <div className="min-w-[120px]">
      <Badge tone="amber">{missing} missing</Badge>
      <p className="mt-1 text-xs font-semibold text-slate-500">{completed}/{required} submitted</p>
    </div>
  )
}

const MetricCard = ({ label, value, formula, helper, tone = 'slate', icon: Icon }) => {
  const tones = {
    slate: 'bg-white text-slate-950 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  }

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-3 break-words text-2xl font-black">{value}</p>
          {formula ? <p className="mt-2 text-xs font-black text-slate-700">Formula: {formula}</p> : null}
          {helper ? <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p> : null}
        </div>
        {Icon ? <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-current shadow-sm"><Icon className="h-5 w-5" /></div> : null}
      </div>
    </div>
  )
}

const SectionHeader = ({ title, description }) => (
  <div>
    <h2 className="text-lg font-black text-slate-950">{title}</h2>
    {description ? <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p> : null}
  </div>
)

const InfoMetric = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
    {helper ? <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p> : null}
  </div>
)

const PerformanceTable = ({ rows = [], type = 'seller' }) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-200">
    <table className="min-w-[880px] w-full divide-y divide-slate-200 text-sm">
      <thead className="bg-slate-50">
        <tr>
          {[type === 'seller' ? 'Seller' : 'Group', 'Sales', 'Sales Value', 'Gross', 'Eligible', 'Released', 'Remaining'].map((head) => (
            <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length ? rows.map((row) => (
          <tr key={`${type}-${row.id || row.seller || row.group}`} className="align-top transition hover:bg-slate-50">
            <td className="px-4 py-4">
              <p className="font-black text-slate-950">{type === 'seller' ? row.seller : row.group}</p>
              {type === 'seller' ? <p className="mt-0.5 text-xs font-semibold text-slate-500">{row.role || '-'} · {row.group || '-'}</p> : null}
            </td>
            <td className="px-4 py-4 font-black text-slate-900">{row.units || 0}</td>
            <td className="px-4 py-4 font-black text-blue-700">{money(row.salesAmount)}</td>
            <td className="px-4 py-4 font-black text-slate-900">{money(row.grossCommission)}</td>
            <td className="px-4 py-4 font-black text-blue-700">{money(row.eligibleCommission)}</td>
            <td className="px-4 py-4 font-semibold text-emerald-700">{money(row.releasedCommission)}</td>
            <td className="px-4 py-4 font-black text-amber-700">{money(row.remainingCommission)}</td>
          </tr>
        )) : (
          <tr>
            <td colSpan={7} className="px-4 py-10 text-center font-semibold text-slate-500">No performance data yet.</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
)


const DEFAULT_STRAIGHT_PAYMENT_MONTHS = 20

const PriceListPrintModal = ({ projectName, onClose, onPrint }) => {
  const [months, setMonths] = useState(String(DEFAULT_STRAIGHT_PAYMENT_MONTHS))
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const parsedMonths = Number(months)

    if (!Number.isInteger(parsedMonths) || parsedMonths < 1 || parsedMonths > 120) {
      setErrorMessage('Straight Payment (Months) must be a whole number from 1 to 120.')
      return
    }

    onPrint(parsedMonths)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">Print Price List</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Set the straight-payment term for {projectName || 'this project'}.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100" aria-label="Close price list settings">
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">Straight Payment (Months)</span>
            <input
              type="number"
              min="1"
              max="120"
              step="1"
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

const PaginationControls = ({ page, pageSize, totalItems, onPageChange, onPageSizeChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = totalItems ? ((currentPage - 1) * pageSize) + 1 : 0
  const end = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-600">Showing {start}-{end} of {totalItems} records</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700">
          {[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300">Previous</button>
        <span className="h-9 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700">Page {currentPage} of {totalPages}</span>
        <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300">Next</button>
      </div>
    </div>
  )
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

const buildBreakdownChartData = (rows = [], labelKey) => rows.slice(0, 8).map((row) => ({
  name: shortLabel(row[labelKey], 18),
  salesCount: Number(row.units || 0),
  salesAmount: Number(row.salesAmount || 0),
  grossCommission: Number(row.grossCommission || 0),
  eligibleCommission: Number(row.eligibleCommission || 0),
  releasedCommission: Number(row.releasedCommission || 0),
}))

const Dashboard = () => {
  const { projectSlug } = useParams()
  const queryClient = useQueryClient()
  const [showDetails, setShowDetails] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showPriceListModal, setShowPriceListModal] = useState(false)
  const [alert, setAlert] = useState(null)
  const [dateRange, setDateRange] = useState('3_months')
  const [dateFrom, setDateFrom] = useState(() => defaultDateRange().from)
  const [dateTo, setDateTo] = useState(() => defaultDateRange().to)
  const [sellerPage, setSellerPage] = useState(1)
  const [sellerPageSize, setSellerPageSize] = useState(10)
  const [recentUnitPage, setRecentUnitPage] = useState(1)
  const [recentUnitPageSize, setRecentUnitPageSize] = useState(10)
  const { data: currentUserData } = useCurrentUser()
  const currentUser = currentUserData?.user || {}
  const isAdmin1 = currentUser.role === 'admin' && (!currentUser.admin_type || currentUser.admin_type === 'admin_1')
  const hasInvalidDateRange = dateRange === 'custom' && (!dateFrom || !dateTo || dateFrom > dateTo)
  const adminRangeBlocked = isAdmin1 && exceedsTwelveMonths(dateFrom, dateTo)
  const canLoadDateRange = !hasInvalidDateRange && !adminRangeBlocked

  const handleRangeChange = (value) => {
    setDateRange(value)
    if (value !== 'custom') {
      const nextRange = resolvePresetDateRange(value)
      setDateFrom(nextRange.from)
      setDateTo(nextRange.to)
    }
  }

  const dashboardQuery = useMemo(() => {
    const params = new URLSearchParams({ range: dateRange, from: dateFrom, to: dateTo })
    return params.toString()
  }, [dateRange, dateFrom, dateTo])

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['lot-dashboard', projectSlug, dashboardQuery],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/dashboard?${dashboardQuery}`),
    enabled: Boolean(projectSlug) && canLoadDateRange,
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
  const sellerPerformance = data?.data?.sellerPerformance || []
  const groupPerformance = data?.data?.groupPerformance || []
  const salesTrend = data?.data?.salesTrend || []
  const stats = data?.data?.stats || {}

  const updateProjectMutation = useMutation({
    mutationFn: (payload) => useFetchPut(`/projects/lot-projects/${project.project_bailen_id}`, payload),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving project changes...' }),
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

  const handleSaveProject = (updatedProject) => updateProjectMutation.mutateAsync(updatedProject)

  const handleRefresh = () => {
    if (!canLoadDateRange) return
    setAlert({ type: 'info', message: 'Refreshing project dashboard...' })
    queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
  }

  const handlePrintPriceList = (straightPaymentMonths) => {
    const params = new URLSearchParams({ straightPaymentMonths: String(straightPaymentMonths) })
    window.open(`/lot-projects/${projectSlug}/price-list/print?${params.toString()}`, '_blank')
    setShowPriceListModal(false)
  }

  const primarySnapshotStats = [
    { label: 'Total Gross Sales', value: isLoading ? '...' : money(stats.totalGrossSales ?? stats.totalSales), formula: 'Cash Collected + Gross Cash Collectibles', helper: 'Active and pending-cancellation reservation contracts in the selected range.', tone: 'blue', icon: FiTrendingUp },
    { label: 'Cash Collected', value: isLoading ? '...' : money(stats.totalCashCollected ?? stats.totalCollected), formula: 'Verified payments from current buyer accounts', helper: 'Includes active and pending-cancellation accounts only. Finalized cancelled-account cash stays in the cancellation totals.', tone: 'green', icon: FiActivity },
    { label: 'Penalty Accumulated', value: isLoading ? '...' : money(stats.totalPenaltyAccumulated), formula: 'Paid penalties + outstanding penalties after approved waivers', helper: `Paid ${money(stats.totalPenaltyPaid)} · Outstanding ${money(stats.totalPenaltyOutstanding)} for the selected reservation accounts.`, tone: 'red', icon: FiAlertTriangle },
    { label: 'Cash Collectibles − Discount', value: isLoading ? '...' : money(stats.netCashCollectibles), formula: 'Gross Cash Collectibles − Discount Applied', helper: `${money(stats.grossCashCollectibles ?? stats.cashCollectibles)} gross collectibles less ${money(stats.discountApplied)} discount.`, tone: 'amber', icon: FiGrid },
    { label: 'Total Number of Reservations', value: isLoading ? '...' : number(stats.reservationCount), formula: 'Reservation-history records created in range', helper: 'Includes active, pending, and later-cancelled reservation events.', tone: 'indigo', icon: FiUsers },
    { label: 'Total Net Sales', value: isLoading ? '...' : money(stats.totalNetSales), formula: 'Total Gross Sales − Discount Applied', helper: 'Finalized cancellations are reported separately.', tone: 'slate', icon: FiLayers },
  ]

  const cancellationSnapshotStats = [
    { label: 'Pending Cancellations', value: isLoading ? '...' : `${number(stats.pendingCancellation)} · ${money(stats.pendingCancellationValue)}`, formula: 'Current pending-cancellation units and TCP', helper: 'Operational cases still awaiting a final cancellation decision.', tone: 'amber', icon: FiAlertTriangle },
    { label: 'Finalized Cancellations', value: isLoading ? '...' : `${number(stats.cancelledCount)} · ${money(stats.cancelledValue)}`, formula: 'Cancellation events and value in the selected range', helper: 'Historical cancellation activity, separate from current inventory status.', tone: 'slate', icon: FiTrendingDown },
    { label: 'Refunded Amount', value: isLoading ? '...' : money(stats.totalRefundedAmount), formula: 'Sum of refunded cancellation settlements', helper: 'Cash returned to cancelled buyers in the selected range.', tone: 'blue', icon: FiTrendingDown },
    { label: 'Discontinued Amount', value: isLoading ? '...' : money(stats.totalDiscontinuedAmount), formula: 'Cancellation cash collected − refunded amount', helper: 'Cancelled-buyer cash retained by the company in the selected range.', tone: 'amber', icon: FiActivity },
  ]

  const commissionChartData = [
    { label: 'Total', value: Number(stats.totalCommission || 0), color: chartColors.blue },
    { label: 'Eligible', value: Number(stats.eligibleCommission || 0), color: chartColors.amber },
    { label: 'Released', value: Number(stats.releasedCommission || 0), color: chartColors.green },
    { label: 'Remaining', value: Number(stats.netRemainingCommission || 0), color: chartColors.red },
  ]

  const inventoryChartData = [
    { label: 'Listed', value: Number(stats.listedLotValue || 0), color: chartColors.slate },
    { label: 'Available', value: Number(stats.availableLotValue || 0), color: chartColors.green },
    { label: 'Sold', value: Number(stats.soldLotValue || 0), color: chartColors.indigo },
  ]

  const unitStatusChartData = [
    { label: 'Available', count: Number(stats.available || 0), color: chartColors.green },
    { label: 'Hold', count: Number(stats.hold || 0), color: chartColors.amber },
    { label: 'Sold Active', count: Number(stats.soldActive || 0), color: chartColors.blue },
    { label: 'Fully Paid', count: Number(stats.fullyPaid || 0), color: chartColors.indigo },
    { label: 'Pending Cancel', count: Number(stats.pendingCancellation || 0), color: chartColors.violet },
    { label: 'Cancelled', count: Number(stats.cancelled || 0), color: chartColors.red },
  ]

  const sellerChartData = buildBreakdownChartData(sellerPerformance, 'seller')
  const groupChartData = buildBreakdownChartData(groupPerformance, 'group')
  const sellerTotalPages = Math.max(1, Math.ceil(sellerPerformance.length / sellerPageSize))
  const sellerCurrentPage = Math.min(sellerPage, sellerTotalPages)
  const paginatedSellerPerformance = sellerPerformance.slice((sellerCurrentPage - 1) * sellerPageSize, sellerCurrentPage * sellerPageSize)
  const recentUnitTotalPages = Math.max(1, Math.ceil(recentUnits.length / recentUnitPageSize))
  const recentUnitCurrentPage = Math.min(recentUnitPage, recentUnitTotalPages)
  const paginatedRecentUnits = recentUnits.slice((recentUnitCurrentPage - 1) * recentUnitPageSize, recentUnitCurrentPage * recentUnitPageSize)

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title={`${project.project_bailen_name || 'Lot Project'} Dashboard`} description="Project overview, chart analytics, unit activity, documents, and project controls." icon={FiMapPin} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setShowDetails(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"><FiEye className="h-4 w-4" />View Details</button>
          <button type="button" onClick={() => setShowEdit(true)} disabled={isDocumentsLoading || isTemplatesLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"><FiEdit3 className="h-4 w-4" />Edit Project</button>
          <button type="button" onClick={() => setShowPriceListModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"><FiPrinter className="h-4 w-4" />Price List</button>
        </div>
      </section>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading project dashboard..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing dashboard data..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load project dashboard.'} /> : null}

      <DateRangeFilter
        range={dateRange}
        onRangeChange={handleRangeChange}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        isFetching={isFetching}
        isAdmin1={isAdmin1}
      />

      {hasInvalidDateRange ? <StatusAlert type="error" message="The From date must be earlier than or equal to the To date." /> : null}
      {adminRangeBlocked ? <StatusAlert type="error" message="Admin 1 dashboard reports are limited to 12 months (1 year). Select a shorter custom date range." /> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SectionHeader title="Business Snapshot" description="Main numbers to check first." />
          <button type="button" onClick={handleRefresh} disabled={!canLoadDateRange || isFetching} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Refresh</button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {primarySnapshotStats.map((item) => <MetricCard key={item.label} {...item} />)}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cancellationSnapshotStats.map((item) => <MetricCard key={item.label} {...item} />)}
        </div>
      </section>

      <section className="grid gap-6 grid-cols-1">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Seller Performance Details" description="Sales and commission totals by seller for the selected date range." />
          <div className="mt-4">
            <PerformanceTable rows={paginatedSellerPerformance} type="seller" />
          </div>
          <PaginationControls
            page={sellerCurrentPage}
            pageSize={sellerPageSize}
            totalItems={sellerPerformance.length}
            onPageChange={setSellerPage}
            onPageSizeChange={(size) => { setSellerPageSize(size); setSellerPage(1) }}
          />
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <SectionHeader title="Recent Unit Records" description="Latest project activity with balances, overdue schedules, and document completion." />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1480px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50"><tr>{['Unit','Buyer','TCP','Cash Collected','Discount','Settlement','Pending Balance','Overdue','Documents','Status'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">{head}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan={10} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">Loading recent units...</td></tr> : null}
                {!isLoading && recentUnits.length === 0 ? <tr><td colSpan={10} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No recent unit records yet.</td></tr> : null}
                {!isLoading && paginatedRecentUnits.map((row) => (
                  <tr key={row.id || row.unitCode} className="align-top transition hover:bg-slate-50">
                    <td className="px-5 py-4 font-black text-slate-950">{row.unitCode}</td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{row.buyer}</td>
                    <td className="px-5 py-4 font-black text-slate-900">{money(row.tcp)}</td>
                    <td className="px-5 py-4 font-semibold text-emerald-700">{money(row.cashCollected ?? row.collected)}</td>
                    <td className="px-5 py-4 font-semibold text-amber-700">{money(row.discountApplied)}</td>
                    <td className="px-5 py-4 font-semibold text-indigo-700">{row.progress || '0%'}</td>
                    <td className="px-5 py-4"><PendingBalanceCell row={row} /></td>
                    <td className="px-5 py-4"><OverdueCell row={row} /></td>
                    <td className="px-5 py-4"><DocumentsCell row={row} /></td>
                    <td className="px-5 py-4"><Badge tone={row.status === 'Fully Paid' ? 'green' : row.status?.includes('Pending') ? 'amber' : 'blue'}>{row.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={recentUnitCurrentPage}
            pageSize={recentUnitPageSize}
            totalItems={recentUnits.length}
            onPageChange={setRecentUnitPage}
            onPageSizeChange={(size) => { setRecentUnitPageSize(size); setRecentUnitPage(1) }}
          />
        </div>
      </section>

      <section className="grid gap-6 grid-cols-1">
        <ChartCard title="Group Sales Comparison" description="Column-line chart for sales value and sales count by seller group.">
          {groupChartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={groupChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="money" tickFormatter={compactMoney} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar yAxisId="money" dataKey="salesAmount" name="Sales Value" fill={chartColors.indigo} radius={[8, 8, 0, 0]} />
                <Line yAxisId="count" type="monotone" dataKey="salesCount" name="Sales Count" stroke={chartColors.amber} strokeWidth={3} dot />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="No group performance data yet." />}
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Sales and Settlement Trend" description="Uses the same Total Sales, Cash Collected, Discount Applied, Settled Value, Outstanding Value, and Payable Commission definitions as the Business Snapshot.">
          {salesTrend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={salesTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} />
                <YAxis yAxisId="money" tickFormatter={compactMoney} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Area yAxisId="money" type="monotone" dataKey="totalSales" name="Total Sales" stroke={chartColors.blue} fill={chartColors.blue} fillOpacity={0.12} strokeWidth={3} />
                <Line yAxisId="money" type="monotone" dataKey="collected" name="Cash Collected" stroke={chartColors.green} strokeWidth={3} dot={false} />
                <Line yAxisId="money" type="monotone" dataKey="discountApplied" name="Discount Applied" stroke={chartColors.amber} strokeWidth={3} dot={false} />
                <Line yAxisId="money" type="monotone" dataKey="settledValue" name="Settled Value" stroke={chartColors.indigo} strokeWidth={3} dot={false} />
                <Line yAxisId="money" type="monotone" dataKey="outstandingValue" name="Outstanding Value" stroke={chartColors.red} strokeWidth={3} dot={false} />
                <Line yAxisId="money" type="monotone" dataKey="payableCommission" name="Payable Commission" stroke={chartColors.violet} strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Commission Comparison" description="Column chart for commission liability, eligible releases, released amount, and remaining balance.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={commissionChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={compactMoney} tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Amount" radius={[8, 8, 0, 0]}>
                {commissionChartData.map((item) => <Cell key={item.label} fill={item.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Inventory Value Comparison" description="Column chart for listed, available, and sold lot value.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={inventoryChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={compactMoney} tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Amount" radius={[8, 8, 0, 0]}>
                {inventoryChartData.map((item) => <Cell key={item.label} fill={item.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Unit Status Mix" description="Pie chart showing how units are distributed by current status.">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Pie data={unitStatusChartData.filter((item) => item.count > 0)} dataKey="count" nameKey="label" innerRadius={55} outerRadius={95} paddingAngle={2}>
                {unitStatusChartData.filter((item) => item.count > 0).map((entry) => <Cell key={entry.label} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>



      {showPriceListModal ? <PriceListPrintModal projectName={project.project_bailen_name} onClose={() => setShowPriceListModal(false)} onPrint={handlePrintPriceList} /> : null}
      {showDetails ? <ProjectDetailsModal project={project} onClose={() => setShowDetails(false)} onEdit={() => { setShowDetails(false); setShowEdit(true) }} /> : null}
      {showEdit ? <EditProjectModal project={project} documents={documentsData?.documents || []} templates={templatesData?.templates || []} templateDocuments={templatesData?.template_documents || []} onClose={() => setShowEdit(false)} onSave={handleSaveProject} isSaving={updateProjectMutation.isPending} /> : null}
    </main>
  )
}

export default Dashboard
