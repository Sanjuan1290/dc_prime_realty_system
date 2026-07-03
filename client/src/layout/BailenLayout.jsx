import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FaCircle } from 'react-icons/fa6'
import {
  FiActivity,
  FiBarChart2,
  FiChevronLeft,
  FiCreditCard,
  FiDollarSign,
  FiGrid,
  FiHome,
  FiLogOut,
  FiMap,
  FiMenu,
  FiSettings,
  FiX,
} from 'react-icons/fi'
import useCurrentUser from '../utils/useCurrentUser'
import StatusAlert from '../components/Shared/StatusAlert'

const navGroups = [
  {
    title: 'OVERVIEW',
    description: 'Bailen summary',
    items: [{ label: 'Dashboard', pathname: '', icon: FiHome }],
  },
  {
    title: 'PROJECT',
    description: 'Project records',
    items: [
      { label: 'Bailen Project', pathname: '', icon: FiMap, end: true },
      { label: 'Maragondon Project', pathname: '/super_admin', icon: FiMap, muted: true },
    ],
  },
  {
    title: 'LISTINGS & FINANCE',
    description: 'Inventory and payments',
    items: [
      { label: 'Listings', pathname: 'listings', icon: FiGrid },
      { label: 'Payments', pathname: 'payments', icon: FiCreditCard },
      { label: 'Payments Audit', pathname: 'payment-logs', icon: FiActivity },
      { label: 'Commissions', pathname: 'commissions', icon: FiDollarSign },
    ],
  },
  {
    title: 'ADMINISTRATION',
    description: 'Project settings',
    items: [{ label: 'Settings', pathname: 'settings', icon: FiSettings }],
  },
]

const BailenLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: currentUser, isLoading, isError } = useCurrentUser()

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/user/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Request failed')
      return data
    },
    onSettled: () => {
      queryClient.clear()
      navigate('/', { replace: true })
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <StatusAlert type="loading" message="Loading Bailen access..." />
      </div>
    )
  }

  if (isError) return <Navigate to="/" replace />
  if (currentUser?.user?.must_change_password) return <Navigate to="/change-password" replace />

  const fullName = [currentUser?.user?.first_name, currentUser?.user?.last_name].filter(Boolean).join(' ') || 'Super Admin'
  const email = currentUser?.user?.email || 'superadmin@gmail.com'
  const initials = fullName.split(' ').map((item) => item[0]).join('').slice(0, 2).toUpperCase() || 'SA'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {isSidebarOpen ? <button type="button" aria-label="Close sidebar overlay" onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" /> : null}

      <aside className={`fixed left-0 top-0 z-50 grid h-screen w-72 grid-rows-[auto_1fr_auto] border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 lg:translate-x-0 lg:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black shadow-sm">
                <img src="/logo-mobile.png" alt="D&C Prime Realty" className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">D&amp;C Prime Realty</p>
                <p className="truncate text-xs font-semibold text-slate-500">Bailen Management</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsSidebarOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden">
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Active Project</p>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">LA</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <FaCircle className="h-2.5 w-2.5 text-emerald-600" />
              <p className="font-bold text-slate-950">Bailen</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white p-2">
                <p className="font-semibold text-slate-400">Location</p>
                <p className="truncate font-bold text-slate-700">Bailen, Cavite</p>
              </div>
              <div className="rounded-xl bg-white p-2">
                <p className="font-semibold text-slate-400">Status</p>
                <p className="font-bold text-emerald-700">Active</p>
              </div>
            </div>
            <button type="button" onClick={() => navigate('/super_admin')} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 transition hover:bg-slate-50">
              <FiChevronLeft className="h-3.5 w-3.5" />
              Go Back
            </button>
          </div>
        </div>

        <nav className="overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-5">
              <div className="mb-2 px-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{group.title}</p>
                {group.description ? <p className="text-[11px] font-semibold text-slate-400">{group.description}</p> : null}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={`${group.title}-${item.label}`}
                      to={item.pathname}
                      end={item.end || item.pathname === ''}
                      onClick={() => setIsSidebarOpen(false)}
                      className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${isActive && !item.muted ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-emerald-600 group-hover:text-white">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="truncate text-sm font-bold text-slate-900">{fullName}</p>
            <p className="truncate text-xs font-semibold text-slate-500">{email}</p>
          </div>
          <button type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60">
            <FiLogOut className="h-4 w-4" />
            {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:left-72 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setIsSidebarOpen(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 lg:hidden">
            <FiMenu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FiBarChart2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <h3 className="truncate text-sm font-bold text-slate-950 sm:text-base">Bailen Project</h3>
            </div>
            <p className="truncate text-xs font-semibold text-slate-500 sm:text-sm">Bailen, Cavite • active</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <h3 className="text-sm font-bold text-slate-950">{fullName}</h3>
            <p className="text-xs font-semibold text-slate-500">Project access</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">{initials}</div>
        </div>
      </header>

      <main className="min-h-screen pt-16 lg:pl-72">
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default BailenLayout
