import useCurrentUser from '../../utils/useCurrentUser'
import { hasPermission } from '../../config/permissions'

const PermissionGate = ({ permission, children, fallback = null }) => {
  const { data } = useCurrentUser()
  return hasPermission(data?.user, permission) ? children : fallback
}

export default PermissionGate

