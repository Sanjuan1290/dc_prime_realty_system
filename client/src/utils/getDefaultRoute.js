const getDefaultRoute = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase()

  if (normalizedRole === 'super_admin' || normalizedRole === 'admin') {
    return '/super_admin'
  }

  return '/access-denied'
}

export default getDefaultRoute
