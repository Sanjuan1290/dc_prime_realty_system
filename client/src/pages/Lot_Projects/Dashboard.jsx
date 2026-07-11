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
  FiCreditCard,
  FiEdit3,
  FiEye,
  FiMapPin,
  FiPrinter,
  FiRefreshCw,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ProjectDetailsModal from '../../components/Lot_Projects/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal'
import EditProjectModal from '../../components/Lot_Projects/DashboardComponents/EditProjectModal/EditProjectModal'
import { useFetch, useFetchPut } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))
const compactMoney = (value) => new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
const number = (value) => new Intl.NumberFormat('en-PH').format(Number(value || 0))
const percent = (value) => `${Number(value || 0).toFixed(2)}%`

const chartColors = {
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  indigo: '#4f46e5',
  slate: '#475569',
}

const pieColors = [chartColors.blue, chartColors.green, chartColors.amber, chartColors.red, chartColors.indigo, chartColors.slate]

const dateRangeOptions = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '2_months', label: '2 Months' },
  { value: '3_months', label: '3 Months' },
  { value: '6_months', label: '6 Months' },
  { value: '12_months', label: '12 Months' },
  { value: 'all', label: 'All' },
  { value: 'custom', label: 'Custom' },
]

const todayDate = () => new Date().toISOString().slice(0, 10)

const getDefaultFromDate = () => {
  const date = new Date()
  date.setMonth(date.getMonth() - 3)
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

const shortLabel = (value = '', max = 18) => {
  const text = String(value || '-')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const isMoneyChartKey = (dataKey = '') => {
  const key = String(dataKey || '')

  if (/count|entries|units|clients|projects|listings|collections/i.test(key)) {
    return false
  }

  return /totalSales|pendingSales|salesAmount|collected|inventory|commission|released|eligible|remaining|value|amount|gross|net/i.test(key)
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  const title = label || payload[0]?.name || ''

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {title ? <p className="font-black text-slate-900">{title}</p> : null}
      <div className="mt-1 grid gap-1">
        {payload.map((item) => {
          const isPeso = isMoneyChartKey(item.dataKey)
          return (
            <p key={item.dataKey} className="font-semibold text-slate-600">
              {item.name}: <span className="font-black text-slate-950">{isPeso ? money(item.value) : number(item.value)}</span>
            </p>
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

const DateRangeFilter = ({ range, setRange, dateFrom, setDateFrom, dateTo, setDateTo, isFetching }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-sm font-black text-slate-950">Graph Date Filter</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Use this for line graphs. Snapshot cards still show the current project state.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
        <label className="grid gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Range</span>
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            {dateRangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            disabled={range !== 'custom'}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            disabled={range !== 'custom'}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </label>
      </div>
    </div>

    {isFetching ? <p className="mt-3 text-xs font-black text-blue-700">Updating graph data...</p> : null}
  </section>
)

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

const MetricCard = ({ label, value, helper, tone = 'slate', icon: Icon }) => {
  const tones = {
    slate: 'bg-white text-slate-950',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  }

  return (
    <div className={`rounded-3xl border border-slate-200 p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black">{value}</p>
          {helper ? <p className="mt-1 text-sm font-semibold text-slate-500">{helper}</p> : null}
        </div>
        {Icon ? <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-current shadow-sm"><Icon className="h-5 w-5" /></div> : null}
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
  const [alert, setAlert] = useState(null)
  const [dateRange, setDateRange] = useState('3_months')
  const [dateFrom, setDateFrom] = useState(getDefaultFromDate())
  const [dateTo, setDateTo] = useState(todayDate())

  const dashboardQuery = useMemo(() => {
    const params = new URLSearchParams({ range: dateRange })
    if (dateRange === 'custom') {
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
    }
    return params.toString()
  }, [dateRange, dateFrom, dateTo])

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['lot-dashboard', projectSlug, dashboardQuery],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/dashboard?${dashboardQuery}`),
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
  const upcomingDues = data?.data?.upcomingDues || []
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
    setAlert({ type: 'info', message: 'Refreshing project dashboard...' })
    queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
  }

  const handlePrintPriceList = () => window.open(`/lot-projects/${projectSlug}/price-list/print`, '_blank')

  const topStats = [
    { label: 'Collection Progress', value: isLoading ? '...' : percent(stats.collectionProgress), helper: 'Collected against booked sales.', tone: 'blue', icon: FiTrendingUp },
    { label: 'Total Sales', value: isLoading ? '...' : money(stats.totalSales), helper: 'Booked sold and reserved contract value.', tone: 'slate', icon: FiCreditCard },
    { label: 'Collected', value: isLoading ? '...' : money(stats.totalCollected), helper: 'Verified payments posted.', tone: 'green', icon: FiActivity },
    { label: 'Payable Commission', value: isLoading ? '...' : money(stats.eligibleCommission), helper: 'Eligible releases ready for payout.', tone: 'indigo', icon: FiUsers },
  ]

  const commissionChartData = [
    { label: 'Total', value: Number(stats.totalCommission || 0) },
    { label: 'Eligible', value: Number(stats.eligibleCommission || 0) },
    { label: 'Released', value: Number(stats.releasedCommission || 0) },
    { label: 'Remaining', value: Number(stats.netRemainingCommission || 0) },
  ]

  const inventoryChartData = [
    { label: 'Listed', value: Number(stats.listedLotValue || 0) },
    { label: 'Available', value: Number(stats.availableLotValue || 0) },
    { label: 'Sold', value: Number(stats.soldLotValue || 0) },
  ]

  const unitStatusChartData = [
    { label: 'Available', count: Number(stats.available || 0) },
    { label: 'Hold', count: Number(stats.hold || 0) },
    { label: 'Sold Active', count: Number(stats.soldActive || 0) },
    { label: 'Fully Paid', count: Number(stats.fullyPaid || 0) },
    { label: 'Pending Cancel', count: Number(stats.pendingCancellation || 0) },
    { label: 'Cancelled', count: Number(stats.cancelled || 0) },
  ]

  const sellerChartData = buildBreakdownChartData(sellerPerformance, 'seller')
  const groupChartData = buildBreakdownChartData(groupPerformance, 'group')
  const upcomingDuesChartData = upcomingDues.slice(0, 8).map((row) => ({
    unit: row.unit || '-',
    balanceDue: Number(row.balanceDue || 0),
  }))

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title={`${project.project_bailen_name || 'Lot Project'} Dashboard`} description="Project overview, chart analytics, unit activity, documents, and project controls." icon={FiMapPin} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setShowDetails(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"><FiEye className="h-4 w-4" />View Details</button>
          <button type="button" onClick={() => setShowEdit(true)} disabled={isDocumentsLoading || isTemplatesLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"><FiEdit3 className="h-4 w-4" />Edit Project</button>
          <button type="button" onClick={handlePrintPriceList} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"><FiPrinter className="h-4 w-4" />Price List</button>
        </div>
      </section>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading project dashboard..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing dashboard data..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load project dashboard.'} /> : null}

      <DateRangeFilter
        range={dateRange}
        setRange={setDateRange}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        isFetching={isFetching}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SectionHeader title="Business Snapshot" description="Main numbers to check first." />
          <button type="button" onClick={handleRefresh} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Refresh</button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {topStats.map((item) => <MetricCard key={item.label} {...item} />)}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Sales & Collections Trend" description="Area trend for money values with sales count as a line over the selected date range.">
          {salesTrend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={salesTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} />
                <YAxis yAxisId="money" tickFormatter={compactMoney} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Area yAxisId="money" type="monotone" dataKey="totalSales" name="Total Sales" stroke={chartColors.blue} fill={chartColors.blue} fillOpacity={0.12} strokeWidth={3} />
                <Area yAxisId="money" type="monotone" dataKey="collected" name="Collected" stroke={chartColors.green} fill={chartColors.green} fillOpacity={0.12} strokeWidth={3} />
                <Line yAxisId="count" type="monotone" dataKey="saleCount" name="Sales Count" stroke={chartColors.amber} strokeWidth={3} dot />
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
              <Bar dataKey="value" name="Amount" fill={chartColors.indigo} radius={[8, 8, 0, 0]} />
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
              <Bar dataKey="value" name="Amount" fill={chartColors.amber} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Unit Status Mix" description="Pie chart showing how units are distributed by current status.">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Pie data={unitStatusChartData.filter((item) => item.count > 0)} dataKey="count" nameKey="label" innerRadius={55} outerRadius={95} paddingAngle={2}>
                {unitStatusChartData.filter((item) => item.count > 0).map((entry, index) => <Cell key={entry.label} fill={pieColors[index % pieColors.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Commissions" description="Seller commission liability and payable releases." />
          <div className="mt-4 grid gap-3">
            <InfoMetric label="Total Commission" value={money(stats.totalCommission)} helper="Full liability, including future releases." />
            <InfoMetric label="Eligible Now" value={money(stats.eligibleCommission)} helper="Releases ready for payment." />
            <InfoMetric label="Released" value={money(stats.releasedCommission)} helper="Amount already released." />
            <InfoMetric label="Net Remaining" value={money(stats.netRemainingCommission)} helper="Still payable after released amounts." />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Sales & Collections" description="Booked sales and verified collections." />
          <div className="mt-4 grid gap-3">
            <InfoMetric label="Total Sales" value={money(stats.totalSales)} helper="Contract value from booked accounts." />
            <InfoMetric label="Pending Sales" value={money(stats.pendingSales)} helper="Remaining uncollected balance." />
            <InfoMetric label="Tracked Collections" value={money(stats.totalCollected)} helper="Verified payments posted." />
            <InfoMetric label="Collection Progress" value={percent(stats.collectionProgress)} helper="Collected divided by total sales." />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Inventory" description="Lot value listed, available, and sold." />
          <div className="mt-4 grid gap-3">
            <InfoMetric label="Listed Lot Value" value={money(stats.listedLotValue)} helper="Inventory still tracked." />
            <InfoMetric label="Available Lot Value" value={money(stats.availableLotValue)} helper="Can still be offered or reserved." />
            <InfoMetric label="Sold Lot Value" value={money(stats.soldLotValue)} helper="Marked as sold." />
            <InfoMetric label="Unit Upcoming Dues" value={stats.dueSoonCount || 0} helper={`${money(stats.upcomingDueAmount)} due within 7 days.`} />
            <InfoMetric label="Overdue Units" value={stats.overdueCount || 0} helper="Past-due unpaid or partial rows." />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Seller Sales Comparison" description="Column-line chart for sales value and sales count by individual seller.">
          {sellerChartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={sellerChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="money" tickFormatter={compactMoney} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar yAxisId="money" dataKey="salesAmount" name="Sales Value" fill={chartColors.blue} radius={[8, 8, 0, 0]} />
                <Line yAxisId="count" type="monotone" dataKey="salesCount" name="Sales Count" stroke={chartColors.green} strokeWidth={3} dot />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <EmptyChart message="No seller performance data yet." />}
        </ChartCard>

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
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Seller Performance Details" description="Sales and commission totals by seller." />
          <div className="mt-4">
            <PerformanceTable rows={sellerPerformance} type="seller" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Group Performance Details" description="Sales and commission totals by seller group." />
          <div className="mt-4">
            <PerformanceTable rows={groupPerformance} type="group" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <SectionHeader title="Upcoming Unit Dues" description="Unpaid or partial schedules due within 7 days." />
          </div>
          <div className="p-5">
            <div className="h-56">
              {upcomingDuesChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={upcomingDuesChartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={compactMoney} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="unit" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="balanceDue" name="Balance Due" fill={chartColors.red} radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart message="No upcoming dues within 7 days." />}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[780px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50"><tr>{['Unit','Buyer','Due Date','Description','Balance Due'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">{head}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {upcomingDues.length ? upcomingDues.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4 font-black text-blue-700">{row.unit}</td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{row.buyer}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{row.dueDate}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{row.description}</td>
                    <td className="px-5 py-4 font-black text-amber-700">{money(row.balanceDue)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No upcoming dues within 7 days.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <SectionHeader title="Recent Unit Records" description="Latest project activity." />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50"><tr>{['Unit','Buyer','TCP','Collection','Status'].map((head) => <th key={head} className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">{head}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td colSpan={5} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">Loading recent units...</td></tr> : null}
                {!isLoading && recentUnits.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No recent unit records yet.</td></tr> : null}
                {!isLoading && recentUnits.map((row) => (
                  <tr key={row.id || row.unitCode} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4 font-black text-slate-950">{row.unitCode}</td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{row.buyer}</td>
                    <td className="px-5 py-4 font-black text-slate-900">{money(row.tcp)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{row.progress || '0%'}</td>
                    <td className="px-5 py-4"><Badge tone={row.status === 'Fully Paid' ? 'green' : row.status?.includes('Pending') ? 'amber' : 'blue'}>{row.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader title="Project Details" description="Basic project data and document setup." />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InfoMetric label="Project Name" value={project.project_bailen_name || '-'} />
          <InfoMetric label="Location" value={project.project_bailen_location || '-'} />
          <InfoMetric label="Location Code" value={project.project_bailen_location_code || '-'} />
          <InfoMetric label="Cadastral Lots" value={`${project.cadastral_lots?.filter((lot) => lot.status === 'active').length || 0} active`} />
          <InfoMetric label="Default Documents" value={project.project_bailen_default_documents || 0} />
          <InfoMetric label="Required Documents" value={project.project_bailen_required_documents || 0} />
        </div>
      </section>

      {showDetails ? <ProjectDetailsModal project={project} onClose={() => setShowDetails(false)} onEdit={() => { setShowDetails(false); setShowEdit(true) }} /> : null}
      {showEdit ? <EditProjectModal project={project} documents={documentsData?.documents || []} templates={templatesData?.templates || []} templateDocuments={templatesData?.template_documents || []} onClose={() => setShowEdit(false)} onSave={handleSaveProject} isSaving={updateProjectMutation.isPending} /> : null}
    </main>
  )
}

export default Dashboard

