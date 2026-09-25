import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiShieldOff } from 'react-icons/fi'
import useCurrentUser from '../../utils/useCurrentUser'
import StatusAlert from '../../components/Shared/StatusAlert'
import { getFirstAllowedSystemPath, isSystemUserRole } from '../../config/permissions'

const AccessDenied = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useCurrentUser()
  const user = data?.user

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><StatusAlert type="loading" message="Checking access..." /></div>
  if (isError || !user || !isSystemUserRole(user.role)) return <Navigate to="/portal" replace />
  if (user.must_change_password) return <Navigate to="/portal/change-password" replace />

  const home = getFirstAllowedSystemPath(user)
  const fallback = home === '/portal/access-denied' ? '/portal' : home

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600"><FiShieldOff className="h-8 w-8" /></div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.25em] text-red-600">403 · Access Denied</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">You cannot open this area</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{location.state?.message || 'Your account does not have the required permission or project assignment for this page.'}</p>
        <button type="button" onClick={() => navigate(fallback, { replace: true })} className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700"><FiArrowLeft /> Back to my workspace</button>
      </section>
    </main>
  )
}

export default AccessDenied
