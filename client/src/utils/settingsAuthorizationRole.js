// The protected settings password always belongs to the authenticated user.
// These labels are presentational and never determine server-side authorization.
export const getSettingsAuthorizationLabel = (role) => {
  if (role === 'super_admin') return 'Super Admin'
  if (role === 'system_admin') return 'System Admin'
  return 'Current Account'
}
