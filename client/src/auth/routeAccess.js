export const ADMIN_ROLES = Object.freeze(['super_admin', 'admin'])
export const SUPER_ADMIN_ROLES = Object.freeze(['super_admin'])

export const normalizeRole = (role) => String(role || '').trim().toLowerCase()

export const getProtectedRouteDecision = ({
  isLoading = false,
  isError = false,
  user = null,
  allowedRoles = [],
} = {}) => {
  if (isLoading) return 'loading'
  if (isError || !user) return 'login'
  if (Number(user.must_change_password || 0) === 1 || user.must_change_password === true) {
    return 'change-password'
  }

  const allowed = new Set(allowedRoles.map(normalizeRole).filter(Boolean))
  if (allowed.size > 0 && !allowed.has(normalizeRole(user.role))) return 'forbidden'

  return 'allow'
}
