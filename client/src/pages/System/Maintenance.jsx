import { useEffect, useState } from 'react'
import { FiRefreshCw, FiTool } from 'react-icons/fi'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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

const Maintenance = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [message, setMessage] = useState(
    location.state?.message
      || readSavedMessage()
      || 'The internal system is temporarily under maintenance.'
  )
  const [isChecking, setIsChecking] = useState(false)
  const [notice, setNotice] = useState('')

  const checkStatus = async () => {
    setIsChecking(true)
    setNotice('')

    try {
      const result = await requestApi('/system-status', {
        redirectOnUnavailable: false,
        timeoutMs: 75_000,
      })

      if (result?.status === 'active') {
        navigate('/portal', { replace: true })
        return
      }

      setMessage(
        result?.maintenanceMessage
          || 'The internal system is temporarily under maintenance.'
      )
      setNotice('Maintenance is still in progress.')
    } catch {
      navigate('/server-down', { replace: true })
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    const timer = window.setInterval(checkStatus, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 text-slate-900">
      <section className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xl shadow-slate-200/70 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <FiTool className="h-8 w-8" />
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-amber-700">
          Scheduled maintenance
        </p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">
          The system is temporarily unavailable
        </h1>
        <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">
          {message}
        </p>

        {notice ? (
          <p className="mt-4 text-sm font-semibold text-amber-700">{notice}</p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={checkStatus}
            disabled={isChecking}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            <FiRefreshCw className={isChecking ? 'animate-spin' : ''} />
            {isChecking ? 'Checking...' : 'Check again'}
          </button>

          <Link
            to="/portal"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-black text-slate-700 transition hover:border-blue-500 hover:text-blue-700"
          >
            Administrator sign in
          </Link>
        </div>
      </section>
    </main>
  )
}

export default Maintenance


