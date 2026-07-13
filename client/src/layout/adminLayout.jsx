import { useMemo, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiActivity,
  FiBell,
  FiClock,
  FiFileText,
  FiHome,
  FiLoader,
  FiLogOut,
  FiMap,
  FiMenu,
  FiSettings,
  FiShield,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import useCurrentUser from '../utils/useCurrentUser'
import { useFetch } from '../utils/useFetch'
import StatusAlert from '../components/Shared/StatusAlert'

const getFullName = (user) => [user?.first_name, user?.middle_name, user?.last_name].filter(Boolean).join(' ').trim() || 'Admin'
const getInitials = (user) => `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'A'

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [layoutAlert, setLayoutAlert] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { data: currentUser, isLoading, isError } = useCurrentUser()
  const user = currentUser?.user

  const { data: lotProjectsData, isLoading: isProjectsLoading, isFetching: isProjectsFetching, isError: isProjectsError, error: projectsError } = useQuery({
    queryKey: ['lot-project-options'],
    queryFn: () => useFetch('/projects/lot-projects/options'),
    enabled: Boolean(user) && user?.role === 'admin' && !user?.must_change_password,
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      setLayoutAlert({ type: 'loading', message: 'Logging out...' })
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/logout`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Logout failed.')
      return result
    },
    onSuccess: () => { queryClient.clear(); navigate('/', { replace: true }) },
    onError: (error) => setLayoutAlert({ type: 'error', message: error?.message || 'Logout failed.' }),
  })

  const lotProjectItems = useMemo(() => (lotProjectsData?.data || []).map((project) => ({
    label: project.lot_project_name || project.label,
    pathname: `/lot-projects/${project.lot_project_slug || project.slug}/listings`,
    icon: FiMap,
    absolute: true,
  })), [lotProjectsData])

  const groups = useMemo(() => [
    { title: 'PROJECTS', items: [{ label: 'Projects', pathname: '/admin/projects', icon: FiMap, absolute: true }] },
    {
      title: 'LOT PROJECTS',
      items: lotProjectItems,
      isLoading: isProjectsLoading,
      isError: isProjectsError,
      errorMessage: projectsError?.message || 'Failed to load lot projects.',
    },
    { title: 'HOUSE & LOT PROJECTS', items: [{ label: 'House & Lot Projects', pathname: '/admin/house-lot-projects', icon: FiHome, absolute: true }] },
    { title: 'MANAGEMENT', items: [{ label: 'Accredited Sellers', pathname: '/admin/accredited', icon: FiUsers, absolute: true }] },
    {
      title: 'COMPLIANCE',
      items: [
        { label: 'Documents', pathname: '/admin/documents', icon: FiFileText, absolute: true },
        { label: 'Notifications', pathname: '/admin/notifications', icon: FiBell, absolute: true },
        { label: 'Audit Logs', pathname: '/admin/audit-logs', icon: FiActivity, absolute: true },
      ],
    },
    {
      title: 'EMPLOYEES',
      items: [
        { label: 'Employees', pathname: '/admin/employees', icon: FiUsers, absolute: true },
        { label: 'Attendance', pathname: '/admin/attendance', icon: FiClock, absolute: true },
      ],
    },
    {
      title: 'ADMINISTRATION',
      items: [
        { label: 'Users', pathname: '/admin/users', icon: FiShield, absolute: true },
        { label: 'Settings', pathname: '/admin/settings', icon: FiSettings, absolute: true },
      ],
    },
  ], [isProjectsError, isProjectsLoading, lotProjectItems, projectsError?.message])

  const activeLabel = useMemo(() => {
    for (const group of groups) {
      const item = group.items.find((entry) => location.pathname === entry.pathname || location.pathname.startsWith(`${entry.pathname}/`))
      if (item) return item.label
    }
    return 'Admin Workspace'
  }, [groups, location.pathname])

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><StatusAlert type="loading" message="Loading Admin access..." /></div>
  if (isError || !user) return <Navigate to="/" replace />
  if (user.must_change_password) return <Navigate to="/change-password" replace />
  if (user.role !== 'admin') return <Navigate to={user.role === 'super_admin' ? '/super_admin' : '/'} replace />

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {isSidebarOpen ? <button type="button" aria-label="Close sidebar" onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" /> : null}

      <aside className={`fixed left-0 top-0 z-50 grid h-screen w-72 grid-rows-[auto_1fr_auto] border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 lg:translate-x-0 lg:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-slate-200 bg-gradient-to-b from-white to-blue-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black"><img src="/logo-mobile.png" alt="D&C Prime logo" className="h-7 w-7" /></div>
              <div className="min-w-0"><p className="truncate font-bold">D&amp;C Prime</p><p className="truncate text-xs font-semibold text-slate-500">Admin workspace</p></div>
            </div>
            <button type="button" onClick={() => setIsSidebarOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><FiX className="h-5 w-5" /></button>
          </div>
          <div className="mt-4 rounded-xl border border-blue-100 bg-white p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-blue-600">Current section</p>
            <p className="mt-1 truncate text-sm font-black text-slate-900">{activeLabel}</p>
            {isProjectsFetching ? <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500"><FiLoader className="animate-spin" />Refreshing projects</p> : null}
          </div>
        </div>

        <nav className="overflow-y-auto px-3 py-4">
          {layoutAlert ? <StatusAlert type={layoutAlert.type} message={layoutAlert.message} onClose={layoutAlert.type === 'loading' ? undefined : () => setLayoutAlert(null)} className="mb-4" /> : null}
          {groups.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="mb-2 px-2 text-xs font-black tracking-wide text-slate-500">{group.title}</p>
              {group.isLoading ? <div className="mx-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600"><FiLoader className="mr-2 inline animate-spin" />Loading projects...</div> : null}
              {group.isError ? <div className="mx-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{group.errorMessage}</div> : null}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink key={item.pathname} to={item.pathname} onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Icon className="h-4 w-4" /></span>
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3"><p className="truncate text-sm font-bold">{getFullName(user)}</p><p className="truncate text-xs text-slate-500">{user.email}</p><span className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">Admin · Operational system access</span></div>
          <button type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-60">
            {logoutMutation.isPending ? <FiLoader className="animate-spin" /> : <FiLogOut />} {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:left-72 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setIsSidebarOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 lg:hidden"><FiMenu /></button>
          <div><h2 className="truncate text-base font-black">{activeLabel}</h2><p className="text-xs font-semibold text-slate-500">Admin workspace</p></div>
        </div>
        <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-bold">{getFullName(user)}</p><p className="text-xs text-slate-500">Admin</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white">{getInitials(user)}</div></div>
      </header>

      <main className="min-h-screen pt-16 lg:pl-72"><div className="p-4 sm:p-6 lg:p-8"><Outlet /></div></main>
    </div>
  )
}

export default AdminLayout
