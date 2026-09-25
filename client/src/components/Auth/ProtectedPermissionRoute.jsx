import { Navigate, useParams } from 'react-router-dom'
import StatusAlert from '../Shared/StatusAlert'
import useCurrentUser from '../../utils/useCurrentUser'
import {
  getFirstAllowedSystemPath,
  hasPermission,
  hasProjectScope,
  isSystemUserRole,
} from '../../config/permissions'

const ProtectedPermissionRoute = ({ permission, projectScoped = false, children }) => {
  const { projectSlug } = useParams()
  const { data, isLoading, isError } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-6">
        <StatusAlert type="loading" message="Checking access..." />
      </div>
    )
  }

  const user = data?.user
  if (isError || !user) return <Navigate to="/portal" replace />
  if (user.must_change_password) return <Navigate to="/portal/change-password" replace />
  if (!isSystemUserRole(user.role)) return <Navigate to="/portal" replace />

  if (!hasPermission(user, permission)) {
    return <Navigate to="/portal/access-denied" replace state={{ message: 'You do not have permission to open this page.' }} />
  }

  if (projectScoped && !hasProjectScope(user, projectSlug)) {
    return <Navigate to="/portal/access-denied" replace state={{ message: 'This project is outside your assigned project scope.' }} />
  }

  return children
}

export default ProtectedPermissionRoute
