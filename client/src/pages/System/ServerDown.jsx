import { useEffect, useState } from 'react'
import { FiCloudOff, FiRefreshCw } from 'react-icons/fi'
import { useLocation, useNavigate } from 'react-router-dom'
import { requestApi } from '../../utils/apiClient'

const readSavedMessage = () => {
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem('dc_prime_availability_state') || '{}'
    )
    return String(value?.message || '')
  } catch {
    return ''
  }
}

const ServerDown = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(false)
  const [message, setMessage] = useState(
    location.state?.message
      || readSavedMessage()
      || 'The server cannot be reached right now.'
  )

  const checkServer = async () => {
    setIsChecking(true)

    try {
      const result = await requestApi('/system-status', {
        redirectOnUnavailable: false,
        timeoutMs: 75_000,
      })

      if (result?.status === 'maintenance') {
        navigate('/maintenance', {
          replace: true,
          state: { message: result.maintenanceMessage },
        })
        return
      }

      navigate('/portal', { replace: true })
    } catch (error) {
      setMessage(
        error?.message
          || 'The server is still unavailable. Please try again shortly.'
      )
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    const timer = window.setInterval(checkServer, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
          <FiCloudOff className="h-8 w-8" />
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-blue-300">
          Server unavailable
        </p>
        <h1 className="mt-3 text-3xl font-black">
          We could not connect to the internal system
        </h1>
        <p className="mt-4 text-sm font-semibold leading-7 text-slate-300">
          {message}
        </p>
        <p className="mt-3 text-xs leading-6 text-slate-400">
          The free server may be waking up after inactivity. The first request can take longer than normal.
        </p>

        <button
          type="button"
          onClick={checkServer}
          disabled={isChecking}
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-400/50"
        >
          <FiRefreshCw className={isChecking ? 'animate-spin' : ''} />
          {isChecking ? 'Connecting...' : 'Try again'}
        </button>
      </section>
    </main>
  )
}

export default ServerDown


