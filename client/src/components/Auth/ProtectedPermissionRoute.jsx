import { Navigate } from 'react-router-dom'
import StatusAlert from '../Shared/StatusAlert'
import useCurrentUser from '../../utils/useCurrentUser'
import { getRoleHome, hasPermission } from '../../config/permissions'

const ProtectedPermissionRoute = ({ permission, children }) => {
  const { data, isLoading, isError } = useCurrentUser()
  if (isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><StatusAlert type="loading" message="Checking access..." /></div>
  if (isError || !data?.user) return <Navigate to="/" replace />
  if (!hasPermission(data.user.role, permission)) return <Navigate to={getRoleHome(data.user.role)} replace />
  return children
}

export default ProtectedPermissionRoute


