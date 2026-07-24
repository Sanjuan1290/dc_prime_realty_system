import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  Bar,
  BarChart,
  Cell,
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
  FiAlertTriangle,
  FiArrowRight,
  FiCalendar,
  FiGrid,
  FiLayers,
  FiMapPin,
  FiRefreshCw,
  FiTrendingDown,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import { useFetch } from '../../utils/useFetch'
import useCurrentUser from '../../utils/useCurrentUser'

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))
const compactMoney = (value) => new Intl.NumberFormat('en-PH', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value || 0))
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


const projectScopeOptions = [
  { value: 'all', label: 'All Projects' },
  { value: 'lot', label: 'Lot Only Projects' },
  { value: 'house_lot', label: 'House & Lot Projects' },
]

const getProjectType = (project = {}, fallback = 'lot') => {
  const type = String(project.project_type || project.type || fallback).toLowerCase()
  return type === 'house_lot' || type === 'house-and-lot' || type === 'house_and_lot'
    ? 'house_lot'
    : 'lot'
}

const padDatePart = (value) => String(value).padStart(2, '0')
const toDateInput = (date) => `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`

const parseDateInput = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null

  return date
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

  return {
    from: toDateInput(start),
    to: toDateInput(end),
  }
}

const defaultDateRange = () => resolvePresetDateRange('3_months')

const inclusiveDaySpan = (fromDate, toDate) => {
  const from = parseDateInput(fromDate)
  const to = parseDateInput(toDate)
  if (!from || !to || from > to) return 0

  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.floor((toUtc - fromUtc) / 86400000) + 1
}

const exceedsTwelveMonths = (fromDate, toDate) => {
  const from = parseDateInput(fromDate)
  const to = parseDateInput(toDate)
  if (!from || !to || from > to) return false

  const maximumEnd = new Date(from.getFullYear() + 1, from.getMonth(), from.getDate())
  maximumEnd.setDate(maximumEnd.getDate() - 1)
  return to > maximumEnd
}
const shortLabel = (value = '', max = 18) => {
  const text = String(value || '-')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const isMoneyChartKey = (dataKey = '') => {
  const key = String(dataKey || '')
  if (/count|entries|units|clients|projects|listings|collections|reservations/i.test(key)) return false
  return /sales|collected|collectibles|discount|inventory|commission|released|eligible|remaining|value|amount|gross|net/i.test(key)
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const title = label || payload[0]?.payload?.project || payload[0]?.name || ''

  return (
    <div className="min-w-[185px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {title ? <p className="font-black text-slate-900">{title}</p> : null}
      <div className="mt-2 grid gap-1.5">
        {payload.map((item, index) => {
          const markerColor = item.color || item.fill || item.stroke || item.payload?.fill || '#94a3b8'
          return (
            <div key={`${item.dataKey}-${index}`} className="flex items-center gap-2 font-semibold text-slate-600">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: markerColor }}
              />
              <span>
                {item.name}: <span className="font-black text-slate-950">{isMoneyChartKey(item.dataKey) ? money(item.value) : number(item.value)}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ChartCard = ({ title, description, children }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black text-slate-950">{title}</h2>
    {description ? <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p> : null}
    <div className="mt-5 h-72">{children}</div>
  </div>
)

const EmptyChart = ({ message = 'No chart data for this date range.' }) => (
  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm font-semibold text-slate-500">
    {message}
  </div>
)

const MetricCard = ({ label, value, formula, helper, icon: Icon, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-white text-slate-950 border-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  }

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-3 break-words text-2xl font-black">{value}</p>
          {formula ? <p className="mt-2 text-xs font-black text-slate-700">Formula: {formula}</p> : null}
          {helper ? <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p> : null}
        </div>
        {Icon ? <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm"><Icon className="h-5 w-5" /></div> : null}
      </div>
    </div>
  )
}

const DateRangeFilter = ({
  range,
  onRangeChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  isFetching,
  isAdmin1,
  isSuperAdmin,
  daySpan,
}) => {
  const isCustom = range === 'custom'

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-slate-950"><FiCalendar /> Dashboard Date Filter</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Preset ranges cover complete calendar months. Custom lets you choose exact start and end dates.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Range</span>
            <select value={range} onChange={(event) => onRangeChange(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
              {dateRangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">From date</span>
            <input type="date" value={fromDate} max={isCustom ? toDate || undefined : undefined} onChange={(event) => onFromDateChange(event.target.value)} disabled={!isCustom} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">To date</span>
            <input type="date" value={toDate} min={isCustom ? fromDate || undefined : undefined} onChange={(event) => onToDateChange(event.target.value)} disabled={!isCustom} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" />
          </label>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
        <span>{isAdmin1 ? 'Admin 1 limit: up to 12 months (1 year).' : isSuperAdmin ? 'Super Admin may load longer custom ranges after confirmation.' : 'Select a supported date range.'}</span>
        {daySpan > 0 ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Selected: {number(daySpan)} day{daySpan === 1 ? '' : 's'}</span> : null}
        {isFetching ? <span className="text-blue-700">Updating dashboard data...</span> : null}
      </div>
    </section>
  )
}

const mergeCompanyTrend = (projectReports = []) => {
  const byPeriod = new Map()
  projectReports.forEach((project) => {
    ;(project.salesTrend || []).forEach((item) => {
      const current = byPeriod.get(item.period) || {
        period: item.period,
        label: item.label,
        reservations: 0,
        totalGrossSales: 0,
        cashCollected: 0,
        netCashCollectibles: 0,
        totalNetSales: 0,
      }
      current.reservations += Number(item.saleCount || 0)
      current.totalGrossSales += Number(item.totalSales || 0)
      current.cashCollected += Number(item.collected || 0)
      current.netCashCollectibles += Number(item.netCashCollectibles || 0)
      current.totalNetSales += Number(item.totalNetSales ?? item.netSales ?? 0)
      byPeriod.set(item.period, current)
    })
  })
  return [...byPeriod.values()].sort((a, b) => String(a.period).localeCompare(String(b.period)))
}

const mergeCancellationTrend = (projectReports = []) => {
  const byPeriod = new Map()
  projectReports.forEach((project) => {
    ;(project.cancellationTrend || []).forEach((item) => {
      const current = byPeriod.get(item.period) || {
        period: item.period,
        label: item.label,
        cancellationCount: 0,
        cancellationAmount: 0,
      }
      current.cancellationCount += Number(item.cancellationCount || 0)
      current.cancellationAmount += Number(item.cancellationAmount || 0)
      byPeriod.set(item.period, current)
    })
  })
  return [...byPeriod.values()].sort((a, b) => String(a.period).localeCompare(String(b.period)))
}

const Dashboard = () => {
  const [dateRange, setDateRange] = useState('3_months')
  const [fromDate, setFromDate] = useState(() => defaultDateRange().from)
  const [toDate, setToDate] = useState(() => defaultDateRange().to)
  const [approvedLongRangeKey, setApprovedLongRangeKey] = useState('')
  const [projectScope, setProjectScope] = useState('all')
  const { data: currentUserData } = useCurrentUser()
  const currentUser = currentUserData?.user || {}
  const role = currentUser.role || 'super_admin'
  const isAdmin = role === 'admin'
  const isAdmin1 = isAdmin && (!currentUser.admin_type || currentUser.admin_type === 'admin_1')
  const isSuperAdmin = role === 'super_admin'
  const roleBasePath = isAdmin ? '/admin' : '/super_admin'
  const houseLotEnabled = import.meta.env.VITE_FEATURE_HOUSE_LOT === 'true'
  const projectsPath = projectScope === 'lot'
    ? `${roleBasePath}/lot-projects`
    : projectScope === 'house_lot'
      ? `${roleBasePath}/house-lot-projects`
      : `${roleBasePath}/projects`
  const selectedDaySpan = inclusiveDaySpan(fromDate, toDate)
  const hasInvalidOrder = selectedDaySpan <= 0
  const isLongerThanTwelveMonths = exceedsTwelveMonths(fromDate, toDate)
  const adminRangeBlocked = isAdmin1 && isLongerThanTwelveMonths
  const longRangeKey = `${fromDate}:${toDate}`
  const superAdminNeedsConfirmation = isSuperAdmin && dateRange === 'custom' && isLongerThanTwelveMonths && approvedLongRangeKey !== longRangeKey
  const canLoadRange = !hasInvalidOrder && !adminRangeBlocked && !superAdminNeedsConfirmation

  const resetApproval = () => setApprovedLongRangeKey('')

  const handleRangeChange = (value) => {
    setDateRange(value)
    resetApproval()

    if (value !== 'custom') {
      const nextRange = resolvePresetDateRange(value)
      setFromDate(nextRange.from)
      setToDate(nextRange.to)
    }
  }

  const handleCancelLongRange = () => {
    const fallbackRange = '3_months'
    const fallbackDates = resolvePresetDateRange(fallbackRange)

    setDateRange(fallbackRange)
    setFromDate(fallbackDates.from)
    setToDate(fallbackDates.to)
    resetApproval()
  }

  const dashboardQuery = useMemo(() => {
    const params = new URLSearchParams({
      range: dateRange,
      from: fromDate,
      to: toDate,
    })
    return params.toString()
  }, [dateRange, fromDate, toDate])

  const shouldLoadLotProjects = projectScope !== 'house_lot'
  const shouldLoadHouseLotProjects = projectScope !== 'lot' && houseLotEnabled

  const lotProjectsQuery = useQuery({
    queryKey: ['system-dashboard-lot-projects'],
    queryFn: () => useFetch('/projects/lot-projects'),
    enabled: shouldLoadLotProjects,
  })

  const houseLotProjectsQuery = useQuery({
    queryKey: ['system-dashboard-house-lot-projects'],
    queryFn: () => useFetch('/projects/house-lot-projects'),
    enabled: shouldLoadHouseLotProjects,
  })

  const selectedProjects = useMemo(() => {
    const lotProjects = shouldLoadLotProjects
      ? (lotProjectsQuery.data?.data || []).map((project) => ({
          ...project,
          projectType: getProjectType(project, 'lot'),
          dashboardBasePath: '/projects/lot-projects',
        }))
      : []

    const houseLotProjects = shouldLoadHouseLotProjects
      ? (houseLotProjectsQuery.data?.data || []).map((project) => ({
          ...project,
          projectType: getProjectType(project, 'house_lot'),
          dashboardBasePath: '/projects/house-lot-projects',
        }))
      : []

    return [...lotProjects, ...houseLotProjects]
  }, [
    houseLotProjectsQuery.data,
    lotProjectsQuery.data,
    shouldLoadHouseLotProjects,
    shouldLoadLotProjects,
  ])

  const projectKeys = selectedProjects
    .map((project) => `${project.projectType}:${project.slug || project.lot_project_slug || project.house_lot_project_slug}`)
    .join('|')

  const {
    data: dashboardList = [],
    isLoading: isDashboardsLoading,
    isFetching: isDashboardsFetching,
    isError: isDashboardsError,
    error: dashboardsError,
    refetch,
  } = useQuery({
    queryKey: ['system-dashboard-project-stats', projectScope, projectKeys, dashboardQuery],
    queryFn: () => Promise.all(selectedProjects.map((project) => {
      const slug = project.slug || project.lot_project_slug || project.house_lot_project_slug
      return useFetch(`${project.dashboardBasePath}/${slug}/dashboard?${dashboardQuery}`)
    })),
    enabled: selectedProjects.length > 0 && canLoadRange,
  })

  const projectReports = useMemo(() => selectedProjects.map((project, index) => {
    const dashboard = dashboardList[index]?.data || {}
    const payload = dashboard.project || project
    return {
      name: payload.name || payload.lot_project_name || payload.house_lot_project_name || project.name || project.lot_project_name || project.house_lot_project_name || 'Project',
      projectType: project.projectType,
      stats: dashboard.stats || {},
      salesTrend: dashboard.salesTrend || [],
      cancellationTrend: dashboard.cancellationTrend || [],
    }
  }), [dashboardList, selectedProjects])

  const summary = useMemo(() => projectReports.reduce((total, report) => {
    const stats = report.stats || {}
    total.totalGrossSales += Number(stats.totalGrossSales ?? stats.totalSales ?? 0)
    total.cashCollected += Number(stats.totalCashCollected ?? stats.totalCollected ?? 0)
    total.grossCashCollectibles += Number(stats.grossCashCollectibles ?? stats.cashCollectibles ?? 0)
    total.discountApplied += Number(stats.discountApplied || 0)
    total.netCashCollectibles += Number(stats.netCashCollectibles || 0)
    total.penaltyAccumulated += Number(stats.totalPenaltyAccumulated || 0)
    total.penaltyPaid += Number(stats.totalPenaltyPaid || 0)
    total.penaltyOutstanding += Number(stats.totalPenaltyOutstanding || 0)
    total.reservationCount += Number(stats.reservationCount || 0)
    total.totalNetSales += Number(stats.totalNetSales || 0)
    total.cancelledCount += Number(stats.cancelledCount || 0)
    total.cancelledValue += Number(stats.cancelledValue || 0)
    total.totalRefundedAmount += Number(stats.totalRefundedAmount || 0)
    total.totalDiscontinuedAmount += Number(stats.totalDiscontinuedAmount || 0)
    total.totalCommission += Number(stats.totalCommission || 0)
    total.eligibleCommission += Number(stats.eligibleCommission || 0)
    total.releasedCommission += Number(stats.releasedCommission || 0)
    total.netRemainingCommission += Number(stats.netRemainingCommission || 0)
    total.listedInventory += Number(stats.listedLotValue || 0)
    total.availableInventory += Number(stats.availableLotValue || 0)
    total.soldInventory += Number(stats.soldLotValue || 0)
    total.pendingCancellationValue += Number(stats.pendingCancellationValue || 0)
    total.pendingCancellationCount += Number(stats.pendingCancellation || 0)
    return total
  }, {
    totalGrossSales: 0,
    cashCollected: 0,
    grossCashCollectibles: 0,
    discountApplied: 0,
    netCashCollectibles: 0,
    penaltyAccumulated: 0,
    penaltyPaid: 0,
    penaltyOutstanding: 0,
    reservationCount: 0,
    totalNetSales: 0,
    cancelledCount: 0,
    cancelledValue: 0,
    totalRefundedAmount: 0,
    totalDiscontinuedAmount: 0,
    totalCommission: 0,
    eligibleCommission: 0,
    releasedCommission: 0,
    netRemainingCommission: 0,
    listedInventory: 0,
    availableInventory: 0,
    soldInventory: 0,
    pendingCancellationValue: 0,
    pendingCancellationCount: 0,
  }), [projectReports])

  const companySalesTrend = useMemo(() => mergeCompanyTrend(projectReports), [projectReports])
  const cancellationTrend = useMemo(() => mergeCancellationTrend(projectReports), [projectReports])
  const projectSalesChart = projectReports.map((report) => ({
    project: shortLabel(report.name),
    totalGrossSales: Number(report.stats?.totalGrossSales ?? report.stats?.totalSales ?? 0),
    cashCollected: Number(report.stats?.totalCashCollected || 0),
    discountApplied: Number(report.stats?.discountApplied || 0),
    netCashCollectibles: Number(report.stats?.netCashCollectibles || 0),
  }))
  const projectReservationChart = projectReports.map((report) => ({
    project: shortLabel(report.name),
    reservations: Number(report.stats?.reservationCount || 0),
    cancellations: Number(report.stats?.cancelledCount || 0),
    paymentEntries: report.salesTrend.reduce((sum, item) => sum + Number(item.collectionCount || 0), 0),
  }))
  const projectInventoryChart = projectReports.map((report) => ({
    project: shortLabel(report.name),
    listedInventory: Number(report.stats?.listedLotValue || 0),
    availableInventory: Number(report.stats?.availableLotValue || 0),
    soldInventory: Number(report.stats?.soldLotValue || 0),
    pendingCancellationValue: Number(report.stats?.pendingCancellationValue || 0),
    cancelledInventoryValue: Number(report.stats?.cancelledInventoryValue || 0),
  }))
  const projectDueChart = projectReports.map((report) => ({
    project: shortLabel(report.name),
    dueSoon: Number(report.stats?.dueSoonCount || 0),
    overdue: Number(report.stats?.overdueCount || 0),
  }))
  const commissionChartData = [
    { label: 'Total', value: Number(summary.totalCommission || 0), color: chartColors.blue },
    { label: 'Eligible', value: Number(summary.eligibleCommission || 0), color: chartColors.amber },
    { label: 'Released', value: Number(summary.releasedCommission || 0), color: chartColors.green },
    { label: 'Remaining', value: Number(summary.netRemainingCommission || 0), color: chartColors.red },
  ]
  const isProjectsLoading = (shouldLoadLotProjects && lotProjectsQuery.isLoading)
    || (shouldLoadHouseLotProjects && houseLotProjectsQuery.isLoading)
  const isProjectsError = (shouldLoadLotProjects && lotProjectsQuery.isError)
    || (shouldLoadHouseLotProjects && houseLotProjectsQuery.isError)
  const projectsError = lotProjectsQuery.error || houseLotProjectsQuery.error
  const isLoading = isProjectsLoading || (canLoadRange && isDashboardsLoading)
  const selectedScopeLabel = projectScopeOptions.find((option) => option.value === projectScope)?.label || 'All Projects'

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader title="System Dashboard" description="Company sales, reservations, cancellations, inventory, and collection reporting." icon={FiLayers} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="grid gap-1 sm:min-w-56">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Project type</span>
            <select
              value={projectScope}
              onChange={(event) => setProjectScope(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            >
              {projectScopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => refetch()} disabled={!canLoadRange || isDashboardsFetching || selectedProjects.length === 0} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
            <FiRefreshCw className={isDashboardsFetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {isProjectsLoading ? <StatusAlert type="loading" message="Loading system dashboard..." /> : null}
      {isProjectsError ? <StatusAlert type="error" message={projectsError?.message || 'Failed to load system dashboard.'} /> : null}
      {projectScope === 'house_lot' && !houseLotEnabled ? <StatusAlert type="info" message="House & Lot project reporting is not active yet." /> : null}
      {isDashboardsError && canLoadRange ? <StatusAlert type="error" message={dashboardsError?.message || 'Failed to load project dashboard totals.'} /> : null}

      <DateRangeFilter
        range={dateRange}
        onRangeChange={handleRangeChange}
        fromDate={fromDate}
        onFromDateChange={(value) => { setFromDate(value); resetApproval() }}
        toDate={toDate}
        onToDateChange={(value) => { setToDate(value); resetApproval() }}
        isFetching={isDashboardsFetching}
        isAdmin1={isAdmin1}
        isSuperAdmin={isSuperAdmin}
        daySpan={selectedDaySpan}
      />

      {hasInvalidOrder ? <StatusAlert type="error" message="The From date must be earlier than or equal to the To date." /> : null}
      {adminRangeBlocked ? <StatusAlert type="error" message="Admin 1 dashboard reports are limited to 12 months (1 year). Select a shorter custom date range." /> : null}
      {superAdminNeedsConfirmation ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div><p className="font-black">Large date range</p><p className="mt-1 text-sm font-semibold">This report covers {number(selectedDaySpan)} days and may take longer to load.</p></div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleCancelLongRange}
                className="h-10 rounded-xl border border-amber-300 bg-white px-4 text-sm font-black text-amber-900 hover:bg-amber-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setApprovedLongRangeKey(longRangeKey)}
                className="h-10 rounded-xl bg-amber-600 px-4 text-sm font-black text-white hover:bg-amber-700"
              >
                Continue and load
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Total Gross Sales" value={isLoading ? '...' : money(summary.totalGrossSales)} formula="Cash Collected + Gross Cash Collectibles" helper="Active and pending-cancellation reservation contracts in the selected range." icon={FiTrendingUp} tone="blue" />
        <MetricCard label="Cash Collected" value={isLoading ? '...' : money(summary.cashCollected)} formula="Sum of verified payments" helper="Includes paid penalties because verified payments store one gross receipt amount." icon={FiActivity} tone="green" />
        <MetricCard label="Penalty Accumulated" value={isLoading ? '...' : money(summary.penaltyAccumulated)} formula="Paid penalties + outstanding penalties after approved waivers" helper={`Paid ${money(summary.penaltyPaid)} · Outstanding ${money(summary.penaltyOutstanding)} for the selected reservation accounts.`} icon={FiAlertTriangle} tone="red" />
        <MetricCard label="Cash Collectibles − Discount" value={isLoading ? '...' : money(summary.netCashCollectibles)} formula="Gross Cash Collectibles − Discount Applied" helper={`${money(summary.grossCashCollectibles)} gross collectibles less ${money(summary.discountApplied)} discount.`} icon={FiGrid} tone="amber" />
        <MetricCard label="Total Number of Reservations" value={isLoading ? '...' : number(summary.reservationCount)} formula="Reservation-history records created in range" helper="Includes active, pending, and later-cancelled reservation events." icon={FiUsers} tone="indigo" />
        <MetricCard label="Total Net Sales" value={isLoading ? '...' : money(summary.totalNetSales)} formula="Total Gross Sales − Discount Applied" helper="Finalized cancellations are reported separately." icon={FiLayers} tone="slate" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pending Cancellations" value={isLoading ? '...' : `${number(summary.pendingCancellationCount)} · ${money(summary.pendingCancellationValue)}`} formula="Current pending-cancellation units and TCP" helper="Operational cases still awaiting a final cancellation decision." icon={FiAlertTriangle} tone="amber" />
        <MetricCard label="Finalized Cancellations" value={isLoading ? '...' : `${number(summary.cancelledCount)} · ${money(summary.cancelledValue)}`} formula="Cancellation events and value in the selected range" helper="Historical cancellation activity, separate from current inventory status." icon={FiTrendingDown} tone="slate" />
        <MetricCard label="Refunded Amount" value={isLoading ? '...' : money(summary.totalRefundedAmount)} formula="Sum of refunded cancellation settlements" helper="Cash returned to cancelled buyers across the included projects in the selected range." icon={FiTrendingDown} tone="blue" />
        <MetricCard label="Discontinued Amount" value={isLoading ? '...' : money(summary.totalDiscontinuedAmount)} formula="Cancellation cash collected − refunded amount" helper="Cancelled-buyer cash retained by the company across the included projects in the selected range." icon={FiActivity} tone="amber" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black text-slate-950">{selectedScopeLabel}</p><p className="mt-2 text-3xl font-black">{number(projectReports.length)}</p><p className="mt-1 text-sm font-semibold text-slate-500">Project workspaces included in this dashboard view.</p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiMapPin className="h-6 w-6" /></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Listed Inventory</p><p className="mt-1 font-black">{money(summary.listedInventory)}</p></div>
            <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-700">Available Inventory</p><p className="mt-1 font-black text-emerald-950">{money(summary.availableInventory)}</p></div>
            <div className="rounded-2xl bg-indigo-50 p-4"><p className="text-xs font-black uppercase text-indigo-700">Sold / Active Inventory</p><p className="mt-1 font-black text-indigo-950">{money(summary.soldInventory)}</p></div>
          </div>
          <Link to={projectsPath} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700">Open Projects <FiArrowRight /></Link>
        </div>


        <ChartCard title="Reservations per Project" description="Reservation events, cancellations, and verified payment entries in the selected range.">
          {projectReservationChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={projectReservationChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="project" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip content={<ChartTooltip />} /><Legend /><Bar dataKey="reservations" name="Reservations" fill={chartColors.blue} radius={[8, 8, 0, 0]} /><Bar dataKey="cancellations" name="Cancellations" fill={chartColors.red} radius={[8, 8, 0, 0]} /><Bar dataKey="paymentEntries" name="Payment Entries" fill={chartColors.green} radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart />}
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Company Sales Trend" description="The chart uses the same gross sales, cash, net collectibles, reservations, and net sales definitions as the summary cards.">
          {companySalesTrend.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={companySalesTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} /><YAxis yAxisId="money" tickFormatter={compactMoney} tick={{ fontSize: 11 }} /><YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip content={<ChartTooltip />} /><Legend /><Area yAxisId="money" type="monotone" dataKey="totalGrossSales" name="Gross Sales" stroke={chartColors.blue} fill={chartColors.blue} fillOpacity={0.12} strokeWidth={3} /><Line yAxisId="money" type="monotone" dataKey="cashCollected" name="Cash Collected" stroke={chartColors.green} strokeWidth={3} dot={false} /><Line yAxisId="money" type="monotone" dataKey="netCashCollectibles" name="Cash Collectibles − Discount" stroke={chartColors.amber} strokeWidth={3} dot={false} /><Line yAxisId="money" type="monotone" dataKey="totalNetSales" name="Total Net Sales" stroke={chartColors.indigo} strokeWidth={3} dot={false} /><Line yAxisId="count" type="monotone" dataKey="reservations" name="Total Number of Reservations" stroke={chartColors.violet} strokeWidth={3} dot /></ComposedChart></ResponsiveContainer> : <EmptyChart />}
        </ChartCard>
        <ChartCard title="Sales Summary per Project" description="Gross sales, cash collected, discount, and remaining net collectibles by project.">
          {projectSalesChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={projectSalesChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="project" tick={{ fontSize: 11 }} /><YAxis tickFormatter={compactMoney} tick={{ fontSize: 11 }} /><Tooltip content={<ChartTooltip />} /><Legend /><Bar dataKey="totalGrossSales" name="Gross Sales" fill={chartColors.blue} radius={[8, 8, 0, 0]} /><Bar dataKey="cashCollected" name="Cash Collected" fill={chartColors.green} radius={[8, 8, 0, 0]} /><Bar dataKey="discountApplied" name="Discount Applied" fill={chartColors.amber} radius={[8, 8, 0, 0]} /><Bar dataKey="netCashCollectibles" name="Net Collectibles" fill={chartColors.slate} radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart />}
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Cancellation Trend" description="Finalized cancellation events and their recorded value across the selected dates.">
          {cancellationTrend.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={cancellationTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} /><YAxis yAxisId="money" tickFormatter={compactMoney} tick={{ fontSize: 11 }} /><YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip content={<ChartTooltip />} /><Legend /><Bar yAxisId="count" dataKey="cancellationCount" name="Cancellations" fill={chartColors.red} radius={[8, 8, 0, 0]} /><Line yAxisId="money" type="monotone" dataKey="cancellationAmount" name="Cancelled Value" stroke={chartColors.slate} strokeWidth={3} dot /></ComposedChart></ResponsiveContainer> : <EmptyChart message="No finalized cancellations in this date range." />}
        </ChartCard>
        <ChartCard title="Unit Dues per Project" description="Current due-soon and overdue unit schedules.">
          {projectDueChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={projectDueChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="project" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip content={<ChartTooltip />} /><Legend /><Bar dataKey="dueSoon" name="Due Soon" fill={chartColors.blue} radius={[8, 8, 0, 0]} /><Bar dataKey="overdue" name="Overdue" fill={chartColors.red} radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart />}
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Commission Comparison" description="Company-wide commission liability, eligible releases, released amount, and remaining balance for the selected projects.">
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

        <ChartCard title="Inventory by Project" description="Current listed, available, sold, pending-cancellation, and cancelled values by project.">
          {projectInventoryChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={projectInventoryChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="project" tick={{ fontSize: 11 }} /><YAxis tickFormatter={compactMoney} tick={{ fontSize: 11 }} /><Tooltip content={<ChartTooltip />} /><Legend /><Bar dataKey="listedInventory" name="Listed" fill={chartColors.slate} radius={[8, 8, 0, 0]} /><Bar dataKey="availableInventory" name="Available" fill={chartColors.amber} radius={[8, 8, 0, 0]} /><Bar dataKey="soldInventory" name="Sold / Active" fill={chartColors.indigo} radius={[8, 8, 0, 0]} /><Bar dataKey="pendingCancellationValue" name="Pending Cancellation" fill={chartColors.violet} radius={[8, 8, 0, 0]} /><Bar dataKey="cancelledInventoryValue" name="Cancelled" fill={chartColors.red} radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart />}
        </ChartCard>
      </section>

    </main>
  )
}

export default Dashboard

