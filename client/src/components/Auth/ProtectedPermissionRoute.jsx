import { Navigate } from 'react-router-dom'
import StatusAlert from '../Shared/StatusAlert'
import useCurrentUser from '../../utils/useCurrentUser'
import {
  isMaintenanceError,
  isServerUnavailableError,
} from '../../utils/apiClient'
import { getRoleHome, hasPermission } from '../../config/permissions'

const ProtectedPermissionRoute = ({ permission, children }) => {
  const { data, isLoading, isError, error } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <StatusAlert type="loading" message="Checking access..." />
      </div>
    )
  }

  if (isMaintenanceError(error)) {
    return <Navigate to="/maintenance" replace state={{ message: error.message }} />
  }

  if (isServerUnavailableError(error)) {
    return <Navigate to="/server-down" replace state={{ message: error.message }} />
  }

  if (isError || !data?.user) return <Navigate to="/portal" replace />
  if (!hasPermission(data.user, permission)) {
    return <Navigate to={getRoleHome(data.user.role)} replace />
  }

  return children
}

export default ProtectedPermissionRoute


