import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowRight,
  FiBarChart2,
  FiBell,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiGrid,
  FiMap,
  FiRefreshCw,
  FiSettings,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import { useFetch } from '../../utils/useFetch'
import useCurrentUser from '../../utils/useCurrentUser'
import useNotificationBadge from '../../utils/useNotificationBadge'
import { PERMISSIONS, hasPermission } from '../../config/permissions'

const number = (value) => new Intl.NumberFormat('en-PH').format(Number(value || 0))

const toneStyles = {
  blue: 'border-blue-100 bg-blue-50 text-blue-900',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-900',
  amber: 'border-amber-100 bg-amber-50 text-amber-900',
  red: 'border-red-100 bg-red-50 text-red-900',
  violet: 'border-violet-100 bg-violet-50 text-violet-900',
  slate: 'border-slate-200 bg-white text-slate-900',
}

const iconToneStyles = {
  blue: 'bg-white/80 text-blue-700',
  emerald: 'bg-white/80 text-emerald-700',
  amber: 'bg-white/80 text-amber-700',
  red: 'bg-white/80 text-red-700',
  violet: 'bg-white/80 text-violet-700',
  slate: 'bg-slate-100 text-slate-700',
}

const OverviewCard = ({ label, value, helper, icon: Icon, tone = 'slate', to }) => {
  const content = (
    <article className={`h-full rounded-3xl border p-5 shadow-sm transition ${toneStyles[tone] || toneStyles.slate} ${to ? 'hover:-translate-y-0.5 hover:shadow-md' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black">{value}</p>
          {helper ? <p className="mt-2 text-xs font-semibold text-slate-500">{helper}</p> : null}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${iconToneStyles[tone] || iconToneStyles.slate}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {to ? <p className="mt-4 inline-flex items-center gap-1 text-xs font-black text-blue-700">Open <FiArrowRight /></p> : null}
    </article>
  )

  return to ? <Link to={to} className="block h-full">{content}</Link> : content
}

const QuickLink = ({ title, description, icon: Icon, to, badge }) => (
  <Link to={to} className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition group-hover:bg-blue-50 group-hover:text-blue-700">
        <Icon className="h-5 w-5" />
      </span>
      {Number(badge || 0) > 0 ? <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white">{Number(badge) > 99 ? '99+' : number(badge)}</span> : null}
    </div>
    <h3 className="mt-4 text-base font-black text-slate-950">{title}</h3>
    <p className="mt-1 min-h-10 text-sm font-semibold text-slate-500">{description}</p>
    <p className="mt-4 inline-flex items-center gap-2 text-sm font-black text-blue-700">Open <FiArrowRight className="transition group-hover:translate-x-0.5" /></p>
  </Link>
)

const AttentionRow = ({ title, description, value, tone = 'slate', to }) => {
  const tones = {
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-black text-slate-950">{title}</p>
        <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`min-w-11 rounded-xl px-3 py-2 text-center text-sm font-black ${tones[tone] || tones.slate}`}>{number(value)}</span>
        <Link to={to} className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">Review <FiArrowRight /></Link>
      </div>
    </div>
  )
}

const StatusChip = ({ label, value, tone = 'slate' }) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
    blue: 'bg-blue-50 text-blue-800',
    violet: 'bg-violet-50 text-violet-800',
    red: 'bg-red-50 text-red-800',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <div className={`rounded-2xl px-3 py-2 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] font-black uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-0.5 text-base font-black">{number(value)}</p>
    </div>
  )
}

const Dashboard = () => {
  const { data: currentUserData } = useCurrentUser()
  const user = currentUserData?.user || {}
  const roleBasePath = `/portal/${user?.role || 'super_admin'}`
  const notificationsPath = `${roleBasePath}/notifications`
  const lotProjectsPath = `${roleBasePath}/lot-projects`
  const projectsPath = `${roleBasePath}/projects`

  const dashboardQuery = useQuery({
    queryKey: ['system-operational-dashboard'],
    queryFn: () => useFetch('/projects/dashboard-summary'),
    enabled: Boolean(user?.role),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const notificationState = useNotificationBadge(user)
  const summary = dashboardQuery.data?.data?.summary || {}
  const projects = dashboardQuery.data?.data?.projects || []
  const paymentSummary = notificationState.paymentSummary || {}
  const documentSummary = notificationState.documentSummary || {}

  const quickLinks = useMemo(() => [
    hasPermission(user, PERMISSIONS.SYSTEM_PROJECTS_VIEW) ? {
      title: 'Projects',
      description: 'Manage project information and configuration.',
      icon: FiMap,
      to: projectsPath,
    } : null,
    hasPermission(user, PERMISSIONS.SYSTEM_PROJECTS_VIEW) ? {
      title: 'Lot Projects',
      description: 'Open project workspaces, listings, payments, commissions, and settings.',
      icon: FiGrid,
      to: lotProjectsPath,
    } : null,
    hasPermission(user, PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW) ? {
      title: 'Notifications',
      description: 'Review payment due and document notifications.',
      icon: FiBell,
      to: notificationsPath,
      badge: notificationState.totalCount,
    } : null,
    hasPermission(user, PERMISSIONS.SYSTEM_ACCREDITED_VIEW) ? {
      title: 'Accredited Sellers',
      description: 'Manage accredited sellers and sales team records.',
      icon: FiUsers,
      to: `${roleBasePath}/accredited`,
    } : null,
    hasPermission(user, PERMISSIONS.SYSTEM_DOCUMENTS_VIEW) ? {
      title: 'Documents',
      description: 'Manage document requirements, templates, and records.',
      icon: FiFileText,
      to: `${roleBasePath}/documents`,
    } : null,
    hasPermission(user, PERMISSIONS.SYSTEM_REPORTS_VIEW) ? {
      title: 'Reports',
      description: 'View sales, collections, inventory, cancellations, and performance reporting.',
      icon: FiBarChart2,
      to: `${roleBasePath}/reports`,
    } : null,
    hasPermission(user, PERMISSIONS.EMPLOYEES_VIEW) ? {
      title: 'Employees',
      description: 'Manage employee records and company personnel.',
      icon: FiUsers,
      to: `${roleBasePath}/employees`,
    } : null,
    hasPermission(user, PERMISSIONS.ATTENDANCE_VIEW) ? {
      title: 'Attendance',
      description: 'Review employee attendance and time records.',
      icon: FiCheckCircle,
      to: `${roleBasePath}/attendance`,
    } : null,
    hasPermission(user, PERMISSIONS.AUDIT_LOGS_VIEW) ? {
      title: 'Audit Logs',
      description: 'Review important activity and system record changes.',
      icon: FiActivity,
      to: `${roleBasePath}/audit-logs`,
    } : null,
    hasPermission(user, PERMISSIONS.SYSTEM_SETTINGS_VIEW) ? {
      title: 'Settings',
      description: 'Review and configure system-wide settings.',
      icon: FiSettings,
      to: `${roleBasePath}/settings`,
    } : null,
  ].filter(Boolean), [
    lotProjectsPath,
    notificationState.totalCount,
    notificationsPath,
    projectsPath,
    roleBasePath,
    user,
  ])

  const refreshDashboard = async () => {
    await Promise.all([
      dashboardQuery.refetch(),
      notificationState.refetch(),
    ])
  }

  const isRefreshing = dashboardQuery.isFetching || notificationState.isFetching

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title="Dashboard"
          description="Quick overview of projects, notifications, and items that need attention."
          icon={FiGrid}
        />
        <button
          type="button"
          onClick={refreshDashboard}
          disabled={isRefreshing}
          className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw className={isRefreshing ? 'animate-spin' : ''} /> {isRefreshing ? 'Refreshing...' : 'Refresh Dashboard'}
        </button>
      </div>

      {dashboardQuery.isLoading ? <StatusAlert type="loading" message="Loading dashboard overview..." /> : null}
      {dashboardQuery.isError ? <StatusAlert type="error" message={dashboardQuery.error?.message || 'Failed to load dashboard overview.'} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <OverviewCard
          label="Notifications"
          value={notificationState.isLoading ? '...' : number(notificationState.totalCount)}
          helper={`${number(notificationState.paymentCount)} payment · ${number(notificationState.documentCount)} document`}
          icon={FiBell}
          tone="blue"
          to={notificationsPath}
        />
        <OverviewCard
          label="Active Projects"
          value={dashboardQuery.isLoading ? '...' : number(summary.activeProjects)}
          helper={`${number(summary.totalProjects)} total accessible project${Number(summary.totalProjects || 0) === 1 ? '' : 's'}`}
          icon={FiMap}
          tone="emerald"
          to={projectsPath}
        />
        <OverviewCard
          label="Units On Hold"
          value={dashboardQuery.isLoading ? '...' : number(summary.hold)}
          helper="Currently held units across your projects"
          icon={FiClock}
          tone="amber"
          to={lotProjectsPath}
        />
        <OverviewCard
          label="Pending Cancellations"
          value={dashboardQuery.isLoading ? '...' : number(summary.pendingCancellation)}
          helper="Units awaiting cancellation completion"
          icon={FiAlertTriangle}
          tone="violet"
          to={lotProjectsPath}
        />
        <OverviewCard
          label="Overdue Payments"
          value={notificationState.isLoading ? '...' : number(paymentSummary.overdue)}
          helper="Payment schedules already past due"
          icon={FiAlertTriangle}
          tone="red"
          to={notificationsPath}
        />
        <OverviewCard
          label="Documents Need Attention"
          value={notificationState.isLoading ? '...' : number(notificationState.documentCount)}
          helper={`${number(documentSummary.awaitingApproval)} awaiting approval`}
          icon={FiFileText}
          tone="slate"
          to={notificationsPath}
        />
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-black text-slate-950">Quick Navigation</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Go directly to the area you need.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {quickLinks.map((item) => <QuickLink key={item.title} {...item} />)}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-black text-slate-950">Needs Attention</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Current items that may require action.</p>
          </div>
          <AttentionRow title="Overdue Payments" description="Payment schedules already past their due date." value={paymentSummary.overdue} tone="red" to={notificationsPath} />
          <AttentionRow title="Payments Due Within 7 Days" description="Upcoming payment schedules requiring monitoring." value={paymentSummary.dueSoon} tone="blue" to={notificationsPath} />
          <AttentionRow title="Document Notifications" description="Client documents missing, rejected, or waiting for approval." value={notificationState.documentCount} tone="amber" to={notificationsPath} />
          <AttentionRow title="Units On Hold" description="Units currently held for a client." value={summary.hold} tone="amber" to={lotProjectsPath} />
          <AttentionRow title="Pending Cancellations" description="Units still waiting for cancellation completion." value={summary.pendingCancellation} tone="violet" to={lotProjectsPath} />
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">Project Status Overview</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Current unit status across accessible lot projects.</p>
            </div>
            <Link to={lotProjectsPath} className="inline-flex h-9 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">View All Projects <FiArrowRight /></Link>
          </div>

          {dashboardQuery.isLoading ? (
            <div className="p-5"><StatusAlert type="loading" message="Loading project status..." /></div>
          ) : projects.length === 0 ? (
            <div className="p-8 text-center">
              <FiMap className="mx-auto h-8 w-8 text-slate-300" />
              <h3 className="mt-3 font-black text-slate-900">No projects available</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">No accessible lot projects were found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {projects.map((project) => (
                <article key={project.id} className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-slate-950">{project.name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${project.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{project.status}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{project.location || project.locationCode || 'Location not set'} · {number(project.totalUnits)} unit{Number(project.totalUnits || 0) === 1 ? '' : 's'}</p>
                    </div>
                    <Link to={project.routePath} className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-xl bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700">Open Project <FiArrowRight /></Link>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                    <StatusChip label="Available" value={project.available} tone="emerald" />
                    <StatusChip label="Hold" value={project.hold} tone="amber" />
                    <StatusChip label="Sold" value={project.soldActive} tone="blue" />
                    <StatusChip label="Fully Paid" value={project.fullyPaid} tone="violet" />
                    <StatusChip label="Pending Cancel" value={project.pendingCancellation} tone="amber" />
                    <StatusChip label="Cancelled" value={project.cancelled} tone="red" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default Dashboard
