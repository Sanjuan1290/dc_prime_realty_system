import { Navigate, Outlet, useLocation } from 'react-router-dom'
import StatusAlert from '../components/Shared/StatusAlert'
import useCurrentUser from '../utils/useCurrentUser'
import { getProtectedRouteDecision } from './routeAccess'

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const location = useLocation()
  const {
    data,
    isLoading,
    isError,
  } = useCurrentUser()

  const user = data?.user
  const decision = getProtectedRouteDecision({
    isLoading,
    isError,
    user,
    allowedRoles,
  })

  if (decision === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <StatusAlert type="loading" message="Checking your account access..." />
      </main>
    )
  }

  if (decision === 'login') {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    )
  }

  if (decision === 'change-password') {
    return <Navigate to="/change-password" replace />
  }

  if (decision === 'forbidden') {
    return (
      <Navigate
        to="/access-denied"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
          message: 'Your account does not have permission to open this page.',
        }}
      />
    )
  }

  return <Outlet />
}

export default ProtectedRoute
