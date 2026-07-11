import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  FiActivity,
  FiArrowRight,
  FiGrid,
  FiHome,
  FiLayers,
  FiMapPin,
  FiRefreshCw,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import { useFetch } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))
const compactMoney = (value) => new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))
const percent = (value) => `${Number(value || 0).toFixed(2)}%`
const number = (value) => new Intl.NumberFormat('en-PH').format(Number(value || 0))

const chartColors = {
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  indigo: '#4f46e5',
  slate: '#475569',
}

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

const ChartCard = ({ title, description, children }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div>
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {description ? <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p> : null}
    </div>
    <div className="mt-5 h-72">{children}</div>
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
          Applies to company and per-project line graphs.
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

const MetricCard = ({ label, value, helper, icon: Icon, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-white text-slate-950 border-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  }

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black">{value}</p>
          {helper ? <p className="mt-1 text-sm font-semibold text-slate-500">{helper}</p> : null}
        </div>
        {Icon ? <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/75 text-current shadow-sm"><Icon className="h-5 w-5" /></div> : null}
      </div>
    </div>
  )
}

const ProjectTypeCard = ({ title, count, value, helper, icon: Icon, to, disabled = false }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-black text-slate-950">{title}</p>
        <p className="mt-2 text-3xl font-black text-slate-950">{count}</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{helper}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <Icon className="h-6 w-6" />
      </div>
    </div>

    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Tracked Value</p>
      <p className="mt-1 text-lg font-black text-slate-950">{money(value)}</p>
    </div>

    {disabled ? (
      <span className="mt-4 inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-400">No data yet</span>
    ) : (
      <Link to={to} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700">
        Open
        <FiArrowRight className="h-4 w-4" />
      </Link>
    )}
  </div>
)

const ProjectReportCard = ({ report }) => {
  const stats = report.stats || {}
  const collectionProgress = Number(stats.collectionProgress || 0)
  const saleCount = report.salesTrend.reduce((sum, item) => sum + Number(item.saleCount || 0), 0)

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950">{report.name}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{report.location || 'No location set'}</p>
        </div>
        <Link to={`/lot-projects/${report.slug}`} className="inline-flex h-9 w-fit items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50">
          Open
          <FiArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-blue-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-blue-700">Total Sales</p><p className="mt-1 font-black text-blue-900">{money(stats.totalSales)}</p></div>
        <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Collected</p><p className="mt-1 font-black text-emerald-900">{money(stats.totalCollected)}</p></div>
        <div className="rounded-2xl bg-amber-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-amber-700">Sales Count</p><p className="mt-1 font-black text-amber-900">{number(saleCount)}</p></div>
        <div className="rounded-2xl bg-indigo-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-indigo-700">Payable Commission</p><p className="mt-1 font-black text-indigo-900">{money(stats.eligibleCommission)}</p></div>
      </div>

      <div className="mt-4 h-44 rounded-2xl border border-slate-100 bg-slate-50 p-3">
        {report.salesTrend.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={report.salesTrend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
              <YAxis yAxisId="money" tickFormatter={compactMoney} tick={{ fontSize: 11 }} width={44} />
              <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Area yAxisId="money" type="monotone" dataKey="totalSales" name="Sales" stroke={chartColors.blue} fill={chartColors.blue} fillOpacity={0.12} strokeWidth={2} />
              <Area yAxisId="money" type="monotone" dataKey="collected" name="Collected" stroke={chartColors.green} fill={chartColors.green} fillOpacity={0.12} strokeWidth={2} />
              <Line yAxisId="count" type="monotone" dataKey="saleCount" name="Sales Count" stroke={chartColors.amber} strokeWidth={2} dot />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-black text-slate-500">
          <span>Collection Progress</span>
          <span>{percent(collectionProgress)}</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(collectionProgress, 100)}%` }} />
        </div>
      </div>
    </div>
  )
}

const mergeCompanyTrend = (projectReports = []) => {
  const byPeriod = new Map()

  projectReports.forEach((project) => {
    ;(project.salesTrend || []).forEach((item) => {
      const current = byPeriod.get(item.period) || {
        period: item.period,
        label: item.label,
        saleCount: 0,
        totalSales: 0,
        collected: 0,
        collectionCount: 0,
      }

      current.saleCount += Number(item.saleCount || 0)
      current.totalSales += Number(item.totalSales || 0)
      current.collected += Number(item.collected || 0)
      current.collectionCount += Number(item.collectionCount || 0)

      byPeriod.set(item.period, current)
    })
  })

  return [...byPeriod.values()].sort((a, b) => String(a.period).localeCompare(String(b.period)))
}

const Dashboard = () => {
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

  const { data: projectsData, isLoading: isProjectsLoading, isError: isProjectsError, error: projectsError } = useQuery({
    queryKey: ['system-dashboard-lot-projects'],
    queryFn: () => useFetch('/projects/lot-projects'),
  })

  const lotProjects = projectsData?.data || []

  const { data: dashboardList = [], isLoading: isDashboardsLoading, isFetching: isDashboardsFetching, isError: isDashboardsError, error: dashboardsError } = useQuery({
    queryKey: ['system-dashboard-lot-stats', lotProjects.map((project) => project.slug || project.lot_project_slug).join('|'), dashboardQuery],
    queryFn: async () => {
      const results = await Promise.all(
        lotProjects.map((project) => {
          const slug = project.slug || project.lot_project_slug
          return useFetch(`/projects/lot-projects/${slug}/dashboard?${dashboardQuery}`)
        })
      )

      return results
    },
    enabled: lotProjects.length > 0,
  })

  const projectReports = useMemo(
    () => lotProjects.map((project, index) => {
      const dashboard = dashboardList[index]?.data || {}
      const payload = dashboard.project || project
      const slug = payload.slug || payload.lot_project_slug || project.slug || project.lot_project_slug

      return {
        id: payload.id || payload.lot_project_id || project.id || project.lot_project_id,
        slug,
        name: payload.name || payload.lot_project_name || project.name || project.lot_project_name || 'Lot Project',
        location: payload.location || payload.lot_project_location || project.location || project.lot_project_location || '-',
        status: payload.status || payload.lot_project_status || project.status || project.lot_project_status || 'active',
        documents: project.defaultDocumentsCount || project.default_documents_count || 0,
        stats: dashboard.stats || {},
        salesTrend: dashboard.salesTrend || [],
      }
    }),
    [dashboardList, lotProjects]
  )

  const summary = useMemo(() => {
    return projectReports.reduce(
      (total, item) => {
        const stats = item.stats || {}
        total.totalSales += Number(stats.totalSales || 0)
        total.collected += Number(stats.totalCollected || 0)
        total.pendingSales += Number(stats.pendingSales || 0)
        total.availableInventory += Number(stats.availableLotValue || 0)
        total.listedInventory += Number(stats.listedLotValue || 0)
        total.payableCommission += Number(stats.eligibleCommission || 0)
        total.releasedCommission += Number(stats.releasedCommission || 0)
        total.upcomingDues += Number(stats.dueSoonCount || 0)
        total.overdueDues += Number(stats.overdueCount || 0)
        return total
      },
      {
        totalSales: 0,
        collected: 0,
        pendingSales: 0,
        availableInventory: 0,
        listedInventory: 0,
        payableCommission: 0,
        releasedCommission: 0,
        upcomingDues: 0,
        overdueDues: 0,
      }
    )
  }, [projectReports])

  const collectionProgress = summary.totalSales > 0 ? Math.min((summary.collected / summary.totalSales) * 100, 100) : 0
  const isLoading = isProjectsLoading || isDashboardsLoading
  const companySalesTrend = useMemo(() => mergeCompanyTrend(projectReports), [projectReports])

  const projectSalesChart = projectReports.map((report) => ({
    project: shortLabel(report.name),
    totalSales: Number(report.stats?.totalSales || 0),
    collected: Number(report.stats?.totalCollected || 0),
    pendingSales: Number(report.stats?.pendingSales || 0),
  }))

  const projectSalesCountChart = projectReports.map((report) => ({
    project: shortLabel(report.name),
    salesCount: report.salesTrend.reduce((sum, item) => sum + Number(item.saleCount || 0), 0),
    collections: report.salesTrend.reduce((sum, item) => sum + Number(item.collectionCount || 0), 0),
  }))

  const projectInventoryChart = projectReports.map((report) => ({
    project: shortLabel(report.name),
    listedInventory: Number(report.stats?.listedLotValue || 0),
    availableInventory: Number(report.stats?.availableLotValue || 0),
    soldInventory: Number(report.stats?.soldLotValue || 0),
  }))

  const projectDueChart = projectReports.map((report) => ({
    project: shortLabel(report.name),
    upcoming: Number(report.stats?.dueSoonCount || 0),
    overdue: Number(report.stats?.overdueCount || 0),
  }))

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title="System Dashboard" description="Company view across lot projects and the future house & lot module." icon={FiLayers} />
      </section>

      {isProjectsLoading ? <StatusAlert type="loading" message="Loading system dashboard..." /> : null}
      {isProjectsError ? <StatusAlert type="error" message={projectsError?.message || 'Failed to load system dashboard.'} /> : null}
      {isDashboardsError ? <StatusAlert type="error" message={dashboardsError?.message || 'Failed to load lot project dashboard totals.'} /> : null}

      <DateRangeFilter
        range={dateRange}
        setRange={setDateRange}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        isFetching={isDashboardsFetching}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Sales" value={isLoading ? '...' : money(summary.totalSales)} helper="All tracked lot project sales." icon={FiTrendingUp} tone="blue" />
        <MetricCard label="Collected" value={isLoading ? '...' : money(summary.collected)} helper={`${percent(collectionProgress)} collection progress.`} icon={FiActivity} tone="green" />
        <MetricCard label="Available Inventory" value={isLoading ? '...' : money(summary.availableInventory)} helper="Lot inventory available to sell." icon={FiGrid} tone="amber" />
        <MetricCard label="Payable Commission" value={isLoading ? '...' : money(summary.payableCommission)} helper="Eligible releases ready for payout." icon={FiUsers} tone="indigo" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ProjectTypeCard
          title="Lot Projects"
          count={lotProjects.length}
          value={summary.listedInventory}
          helper="Active lot project workspaces and inventory."
          icon={FiMapPin}
          to="/super_admin/projects"
        />

        <ProjectTypeCard
          title="House & Lot Projects"
          count={0}
          value={0}
          helper="Reserved for the house & lot module. No records yet."
          icon={FiHome}
          disabled
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Company Sales Trend" description="Area trend for total sales and collections with sales count as a line across all lot projects.">
          {companySalesTrend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={companySalesTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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

        <ChartCard title="Total Sales per Project" description="Column chart for total sales, collections, and pending sales per project.">
          {projectSalesChart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectSalesChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="project" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={compactMoney} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="totalSales" name="Total Sales" fill={chartColors.blue} radius={[8, 8, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill={chartColors.green} radius={[8, 8, 0, 0]} />
                <Bar dataKey="pendingSales" name="Pending" fill={chartColors.amber} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Sales Count per Project" description="Column chart for number of sales and collection entries per project in the selected graph range.">
          {projectSalesCountChart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectSalesCountChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="project" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="salesCount" name="Sales Count" fill={chartColors.blue} radius={[8, 8, 0, 0]} />
                <Bar dataKey="collections" name="Payment Entries" fill={chartColors.green} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard title="Inventory by Project" description="Column chart for listed, available, and sold lot value per project.">
          {projectInventoryChart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectInventoryChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="project" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={compactMoney} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="listedInventory" name="Listed" fill={chartColors.slate} radius={[8, 8, 0, 0]} />
                <Bar dataKey="availableInventory" name="Available" fill={chartColors.amber} radius={[8, 8, 0, 0]} />
                <Bar dataKey="soldInventory" name="Sold" fill={chartColors.indigo} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <ChartCard title="Unit Dues by Project" description="Column chart for due-soon and overdue unit schedules.">
          {projectDueChart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectDueChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="project" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="upcoming" name="Due Soon" fill={chartColors.blue} radius={[8, 8, 0, 0]} />
                <Bar dataKey="overdue" name="Overdue" fill={chartColors.red} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Operational Alerts</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Fast checks across project workspaces.</p>

          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Upcoming Unit Dues</p>
              <p className="mt-1 text-2xl font-black text-blue-700">{summary.upcomingDues}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Due within 7 days.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Overdue Unit Dues</p>
              <p className="mt-1 text-2xl font-black text-red-700">{summary.overdueDues}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Past due unpaid or partial schedules.</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4">
              <p className="text-sm font-black text-blue-900">House & Lot module</p>
              <p className="mt-1 text-sm font-semibold text-blue-800">The dashboard already reserves space for it. It will show data once the module has project records.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-950">Project Reports</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Separate report card and compact trend chart for every created lot project.</p>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {projectReports.length ? projectReports.map((report) => (
            <ProjectReportCard key={report.id || report.slug} report={report} />
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm font-semibold text-slate-500 xl:col-span-2">
              No lot projects yet.
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-black text-slate-950">Lot Project Overview</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Project status and setup details.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Project', 'Location', 'Sales', 'Sales Count', 'Collected', 'Status', 'Action'].map((head) => (
                  <th key={head} className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projectReports.length ? projectReports.map((project) => {
                const saleCount = project.salesTrend.reduce((sum, item) => sum + Number(item.saleCount || 0), 0)

                return (
                  <tr key={project.id || project.slug} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4 font-black text-slate-950">{project.name}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{project.location || '-'}</td>
                    <td className="px-5 py-4 font-black text-blue-700">{money(project.stats?.totalSales)}</td>
                    <td className="px-5 py-4 font-black text-slate-900">{number(saleCount)}</td>
                    <td className="px-5 py-4 font-semibold text-emerald-700">{money(project.stats?.totalCollected)}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                        {project.status || 'active'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Link to={`/lot-projects/${project.slug}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50">
                        Open
                        <FiArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center font-semibold text-slate-500">No lot projects yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default Dashboard
