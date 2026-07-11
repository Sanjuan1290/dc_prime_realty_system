import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiLock, FiLogOut } from 'react-icons/fi'
import StatusAlert from '../components/Shared/StatusAlert'
import useCurrentUser from '../utils/useCurrentUser'
import getDefaultRoute from '../utils/getDefaultRoute'
import { apiRequest } from '../utils/apiClient'

const AccessDenied = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useCurrentUser()
  const user = data?.user

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('/user/logout', {
      method: 'POST',
      body: JSON.stringify({}),
      skipAuthRedirect: true,
    }),
    onSettled: () => {
      queryClient.clear()
      navigate('/', { replace: true })
    },
  })

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <StatusAlert type="loading" message="Checking your account access..." />
      </main>
    )
  }

  if (isError || !user) return <Navigate to="/" replace />
  if (Number(user.must_change_password || 0) === 1) return <Navigate to="/change-password" replace />

  const role = String(user.role || '').toLowerCase()
  const hasAdminPortal = ['super_admin', 'admin'].includes(role)
  const message = location.state?.message || (
    hasAdminPortal
      ? 'Your account is signed in, but it does not have permission to open that page or perform that action.'
      : 'Your account is signed in, but this build does not include a portal for your role.'
  )

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <FiLock className="h-8 w-8" />
        </div>

        <h1 className="mt-5 text-2xl font-black">Access denied</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Signed-in account</p>
          <p className="mt-1 text-sm font-black text-slate-950">{user.email}</p>
          <p className="text-xs font-semibold text-slate-600">Role: {user.role}</p>
          {location.state?.from ? (
            <p className="mt-2 break-all text-xs text-slate-500">Blocked path: {location.state.from}</p>
          ) : null}
        </div>

        {logoutMutation.isError ? (
          <div className="mt-5">
            <StatusAlert type="error" message={logoutMutation.error?.message || 'Logout failed.'} />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {hasAdminPortal ? (
            <button
              type="button"
              onClick={() => navigate(getDefaultRoute(user.role), { replace: true })}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700"
            >
              <FiArrowLeft />
              Back to dashboard
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiLogOut />
            {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </section>
    </main>
  )
}

export default AccessDenied
