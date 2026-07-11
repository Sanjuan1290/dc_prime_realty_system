import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AUTH_EVENTS } from '../utils/authEvents'

const AuthEventBridge = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  useEffect(() => {
    const getCurrentPath = () => `${window.location.pathname}${window.location.search}${window.location.hash}`

    const handleUnauthorized = (event) => {
      queryClient.clear()

      if (window.location.pathname === '/') return

      navigate('/', {
        replace: true,
        state: {
          from: getCurrentPath(),
          sessionExpired: true,
          message: event.detail?.message || 'Your session expired. Sign in again.',
        },
      })
    }

    const handleForbidden = (event) => {
      if (window.location.pathname === '/access-denied') return

      navigate('/access-denied', {
        replace: true,
        state: {
          from: getCurrentPath(),
          message: event.detail?.message || 'You do not have permission to perform this action.',
        },
      })
    }

    const handlePasswordChangeRequired = () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })

      if (window.location.pathname !== '/change-password') {
        navigate('/change-password', { replace: true })
      }
    }

    window.addEventListener(AUTH_EVENTS.unauthorized, handleUnauthorized)
    window.addEventListener(AUTH_EVENTS.forbidden, handleForbidden)
    window.addEventListener(AUTH_EVENTS.passwordChangeRequired, handlePasswordChangeRequired)

    return () => {
      window.removeEventListener(AUTH_EVENTS.unauthorized, handleUnauthorized)
      window.removeEventListener(AUTH_EVENTS.forbidden, handleForbidden)
      window.removeEventListener(AUTH_EVENTS.passwordChangeRequired, handlePasswordChangeRequired)
    }
  }, [location.pathname, navigate, queryClient])

  return <Outlet />
}

export default AuthEventBridge
