import { useMemo, useState } from 'react'
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FiBarChart2,
  FiChevronLeft,
  FiDollarSign,
  FiGrid,
  FiLoader,
  FiMenu,
  FiSettings,
  FiShield,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../components/Shared/StatusAlert'
import useCurrentUser from '../utils/useCurrentUser'
import { useFetch } from '../utils/useFetch'

const getPageTitle = (pathname, projectName) => {
  if (pathname.includes('/listings/')) return 'Listing Profile'
  if (pathname.includes('/listings')) return 'Listings / Units'
  if (pathname.includes('/payments-audit')) return 'Payments Audit / Logs'
  if (pathname.includes('/commissions')) return 'Commissions'
  if (pathname.includes('/settings')) return 'Settings'

  return `${projectName || 'Lot Project'} Dashboard`
}

const LotLayout = () => {
  const { projectSlug } = useParams()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    isError: isCurrentUserError,
  } = useCurrentUser()

  const user = currentUser?.user

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ['lot-project', projectSlug],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}`),
    enabled: Boolean(projectSlug) && Boolean(user) && !user?.must_change_password,
  })

  const project = data?.data
  const basePath = `/lot-projects/${projectSlug}`

  const navItems = useMemo(() => {
    const common = [
      { label: 'Listings / Units', path: `${basePath}/listings`, icon: FiGrid },
      { label: 'Payments Audit', path: `${basePath}/payments-audit`, icon: FiShield },
      { label: 'Settings', path: `${basePath}/settings`, icon: FiSettings },
    ]

    if (user?.role === 'admin') return common

    return [
      { label: 'Dashboard', path: basePath, icon: FiBarChart2, end: true },
      common[0],
      common[1],
      { label: 'Commissions', path: `${basePath}/commissions`, icon: FiDollarSign },
      common[2],
    ]
  }, [basePath, user?.role])

  const pageTitle = useMemo(
    () => getPageTitle(location.pathname, project?.lot_project_name),
    [location.pathname, project?.lot_project_name]
  )

  if (isCurrentUserLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <StatusAlert type="loading" message="Loading lot project workspace..." />
      </div>
    )
  }

  if (isCurrentUserError || !user) {
    return <Navigate to="/" replace />
  }

  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />
  }

  if (!['super_admin', 'admin'].includes(user?.role)) {
    return <Navigate to="/" replace />
  }

  if (user?.role === 'admin' && location.pathname === basePath) {
    return <Navigate to={`${basePath}/listings`} replace />
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-xl">
          <StatusAlert
            type="error"
            message={error?.message || 'Failed to load lot project.'}
          />

          <button
            type="button"
            onClick={() => navigate(user?.role === 'admin' ? '/admin/projects' : '/super_admin/projects')}
            className="mt-4 h-11 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700"
          >
            Back to Projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar backdrop"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">
              D&C Prime
            </p>
            <h1 className="mt-1 line-clamp-1 text-xl font-black text-slate-950">
              {project?.lot_project_name || 'Lot Project'}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 lg:hidden"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              Active Project
            </p>

            <p className="mt-2 text-lg font-black text-slate-950">
              {project?.lot_project_name}
            </p>

            <p className="text-sm font-semibold text-slate-600">
              Location Code: {project?.lot_project_location_code}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              {project?.lot_project_location}
            </p>

            <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
              {project?.lot_project_status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={() => navigate(user?.role === 'admin' ? '/admin/projects' : '/super_admin/projects')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            <FiChevronLeft className="h-4 w-4" />
            Back to Projects
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 shadow-sm backdrop-blur md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 lg:hidden"
              >
                <FiMenu className="h-5 w-5" />
              </button>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Project Workspace
                </p>

                <h2 className="text-xl font-black text-slate-950">
                  {pageTitle}
                </h2>
              </div>
            </div>

            {isFetching ? (
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-500 sm:flex">
                <FiLoader className="h-4 w-4 animate-spin" />
                Refreshing
              </div>
            ) : null}
          </div>
        </header>

        <main className="min-h-[calc(100vh-80px)] p-4 md:p-6">
          <Outlet context={{ project }} />
        </main>
      </div>
    </div>
  )
}

export default LotLayout

