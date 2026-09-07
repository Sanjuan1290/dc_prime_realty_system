import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FiCamera, FiLock, FiLogIn, FiLogOut, FiShield } from 'react-icons/fi'
import BarcodeScanner from '../../components/System/employeeComponents/BarcodeScanner'
import StatusAlert from '../../components/Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../utils/useFetch'

const getManilaParts = (date = new Date()) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).formatToParts(date).reduce((acc, part) => {
  if (part.type !== 'literal') acc[part.type] = part.value
  return acc
}, {})

const formatTime = (value) => {
  if (!value) return '—'
  const [hourRaw, minute] = String(value).slice(0, 5).split(':').map(Number)
  const hour = hourRaw % 12 || 12
  return `${hour}:${String(minute).padStart(2, '0')} ${hourRaw >= 12 ? 'PM' : 'AM'}`
}


const getScanProblem = (error) => {
  const code = String(error?.code || '')
  const details = error?.data?.data || {}
  if (code === 'ALREADY_TIMED_IN') {
    return { type: 'warning', title: 'Already Timed In', message: error?.message, employee: details.employee, time: details.time }
  }
  if (code === 'ALREADY_TIMED_OUT') {
    return { type: 'warning', title: 'Already Timed Out', message: error?.message, employee: details.employee, time: details.time }
  }
  if (code === 'TIME_IN_REQUIRED') {
    return { type: 'warning', title: 'Time In Required', message: error?.message, employee: details.employee }
  }
  if (Number(error?.status) === 404) {
    return { type: 'error', title: 'Employee Not Found', message: error?.message || 'No active employee matches that attendance barcode.' }
  }
  if (code === 'INVALID_ATTENDANCE_BARCODE' || code === 'ATTENDANCE_BARCODE_REQUIRED') {
    return { type: 'error', title: 'Invalid Barcode', message: error?.message || 'Scan the 10-digit employee attendance barcode again.' }
  }
  return { type: 'error', title: 'Unable to Record Attendance', message: error?.message || 'Attendance was not recorded.' }
}

const AttendanceKiosk = () => {
  const barcodeInputRef = useRef(null)
  const pinInputRef = useRef(null)
  const resultTimeoutRef = useRef(null)
  const [now, setNow] = useState(new Date())
  const [pin, setPin] = useState('')
  const [action, setAction] = useState('time_in')
  const [barcode, setBarcode] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [notice, setNotice] = useState(null)
  const [scanResult, setScanResult] = useState(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => () => {
    if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current)
  }, [])

  const clearScanResult = () => {
    if (resultTimeoutRef.current) {
      window.clearTimeout(resultTimeoutRef.current)
      resultTimeoutRef.current = null
    }
    setScanResult(null)
  }

  const showTemporaryScanResult = (result, duration = 5000) => {
    if (resultTimeoutRef.current) window.clearTimeout(resultTimeoutRef.current)
    setScanResult(result)
    resultTimeoutRef.current = window.setTimeout(() => {
      setScanResult(null)
      resultTimeoutRef.current = null
      barcodeInputRef.current?.focus()
    }, duration)
  }

  const sessionQuery = useQuery({
    queryKey: ['attendance-kiosk-session'],
    queryFn: () => useFetch('/attendance-kiosk/session', { redirectOnUnavailable: true }),
    retry: false,
    staleTime: 30_000,
  })

  const unlocked = Boolean(sessionQuery.data?.unlocked)

  useEffect(() => {
    if (sessionQuery.isLoading) return
    const timer = window.setTimeout(() => {
      if (unlocked) barcodeInputRef.current?.focus()
      else pinInputRef.current?.focus()
    }, 80)
    return () => window.clearTimeout(timer)
  }, [sessionQuery.isLoading, unlocked])

  const unlockMutation = useMutation({
    mutationFn: () => useFetchPost('/attendance-kiosk/unlock', { pin }, { confirmationHandled: 'technical' }),
    onMutate: () => setNotice({ type: 'loading', message: 'Unlocking attendance station...' }),
    onSuccess: (result) => {
      setPin('')
      setNotice({ type: 'success', message: result?.message || 'Attendance station unlocked.' })
      sessionQuery.refetch()
      window.setTimeout(() => barcodeInputRef.current?.focus(), 100)
    },
    onError: (error) => {
      setPin('')
      setNotice({ type: 'error', message: error?.message || 'Incorrect attendance PIN.' })
      window.setTimeout(() => pinInputRef.current?.focus(), 100)
    },
  })

  const lockMutation = useMutation({
    mutationFn: () => useFetchPost('/attendance-kiosk/lock', {}, { confirmationHandled: 'technical' }),
    onSuccess: () => {
      setBarcode('')
      clearScanResult()
      setNotice(null)
      setShowScanner(false)
      sessionQuery.refetch()
    },
  })

  const scanMutation = useMutation({
    mutationFn: ({ code }) => useFetchPost('/attendance-kiosk/scan', {
      barcode_code: code,
      action,
    }, { confirmationHandled: 'technical' }),
    onMutate: () => {
      setNotice({ type: 'loading', message: action === 'time_in' ? 'Recording Time In...' : 'Recording Time Out...' })
      clearScanResult()
    },
    onSuccess: (result) => {
      const data = result?.data || {}
      setNotice(null)
      showTemporaryScanResult({
        type: 'success',
        action: data.action,
        employee: data.employee,
        time: data.time,
        message: result?.message,
      })
      setBarcode('')
      window.setTimeout(() => barcodeInputRef.current?.focus(), 80)
    },
    onError: (error) => {
      setNotice(null)
      setBarcode('')
      if (error?.code === 'ATTENDANCE_PIN_REQUIRED' || Number(error?.status) === 401 && error?.code === 'ATTENDANCE_PIN_REQUIRED') {
        clearScanResult()
        sessionQuery.refetch()
        return
      }
      showTemporaryScanResult(getScanProblem(error))
      window.setTimeout(() => barcodeInputRef.current?.focus(), 80)
    },
  })

  const submitScan = (explicitCode = '') => {
    const code = String(explicitCode || barcode).replace(/\D/g, '').slice(0, 10)
    if (!code) {
      showTemporaryScanResult({ type: 'error', title: 'Barcode Required', message: 'Scan or enter the 10-digit attendance barcode first.' })
      barcodeInputRef.current?.focus()
      return
    }
    if (!unlocked || scanMutation.isPending) return
    scanMutation.mutate({ code })
  }

  const parts = getManilaParts(now)
  const hour = Number(parts.hour) === 24 ? '00' : parts.hour
  const liveTime = formatTime(`${hour}:${parts.minute}:${parts.second}`)
  const liveDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(now)

  if (sessionQuery.isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5"><p className="font-black text-white">Loading attendance station...</p></main>
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo-mobile.png" alt="D&C Prime Realty" className="h-12 w-12 rounded-2xl object-contain" />
            <div>
              <h1 className="text-xl font-black text-slate-950 sm:text-2xl">Employee Attendance</h1>
              <p className="text-sm font-semibold text-slate-500">Office Time In / Time Out station</p>
            </div>
          </div>
          {unlocked ? (
            <button type="button" onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 shadow-sm disabled:opacity-60">
              <FiLock />Lock Station
            </button>
          ) : null}
        </header>

        {!unlocked ? (
          <section className="mx-auto mt-[8vh] max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="bg-slate-950 px-6 py-6 text-white">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><FiShield className="h-6 w-6" /></span>
              <h2 className="text-2xl font-black">Unlock Attendance</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Enter the office attendance PIN to access Time In and Time Out. This station does not provide access to the admin portal.</p>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); if (!unlockMutation.isPending) unlockMutation.mutate() }} className="grid gap-4 p-6">
              {notice ? <StatusAlert type={notice.type} message={notice.message} /> : null}
              {sessionQuery.isError ? <StatusAlert type="error" message={sessionQuery.error?.message || 'Attendance station could not be loaded.'} /> : null}
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">Attendance PIN</span>
                <input
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="Enter PIN"
                  className="h-14 rounded-2xl border border-slate-300 px-4 text-center font-mono text-2xl font-black tracking-[0.35em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <button type="submit" disabled={!pin || unlockMutation.isPending} className="h-12 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50">
                {unlockMutation.isPending ? 'Unlocking...' : 'Continue to Attendance'}
              </button>
            </form>
          </section>
        ) : (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="bg-slate-950 px-5 py-6 text-white sm:px-7">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="text-sm font-semibold text-slate-300">{liveDate}</p><p className="mt-1 text-4xl font-black sm:text-5xl">{liveTime}</p></div>
                <p className="text-xs font-semibold text-slate-400">Philippine Time · Asia/Manila</p>
              </div>
            </div>

            <div className="grid gap-6 p-5 sm:p-7">
              {notice ? <StatusAlert type={notice.type} message={notice.message} /> : null}

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => { setAction('time_in'); clearScanResult(); barcodeInputRef.current?.focus() }} className={`flex h-20 items-center justify-center gap-3 rounded-2xl border text-lg font-black transition ${action === 'time_in' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-50' : 'border-slate-200 bg-white text-slate-500'}`}><FiLogIn className="h-6 w-6" />TIME IN</button>
                <button type="button" onClick={() => { setAction('time_out'); clearScanResult(); barcodeInputRef.current?.focus() }} className={`flex h-20 items-center justify-center gap-3 rounded-2xl border text-lg font-black transition ${action === 'time_out' ? 'border-orange-300 bg-orange-50 text-orange-700 ring-4 ring-orange-50' : 'border-slate-200 bg-white text-slate-500'}`}><FiLogOut className="h-6 w-6" />TIME OUT</button>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    ref={barcodeInputRef}
                    autoFocus
                    value={barcode}
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="off"
                    onChange={(event) => setBarcode(event.target.value.replace(/\D/g, '').slice(0, 10))}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitScan() } }}
                    placeholder="Scan or enter 10-digit attendance barcode"
                    className="h-14 flex-1 rounded-xl border border-blue-200 bg-white px-4 font-mono text-lg font-black tracking-[0.12em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                  <button type="button" onClick={() => setShowScanner(true)} className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-5 text-sm font-black text-blue-700"><FiCamera />Scan with Camera</button>
                  <button type="button" onClick={() => submitScan()} disabled={scanMutation.isPending} className="h-14 rounded-xl bg-blue-600 px-8 text-sm font-black text-white disabled:opacity-60">Submit</button>
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-blue-700">Scan the printed 10-digit attendance barcode. USB/Bluetooth scanners and manual numeric entry remain available as fallbacks.</p>
              </div>

              {scanResult ? (
                <div className={`rounded-3xl border p-6 text-center ${
                  scanResult.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50'
                    : scanResult.type === 'warning'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-red-200 bg-red-50'
                }`}>
                  {scanResult.type === 'success' ? (
                    <>
                      <p className="text-sm font-black uppercase tracking-wide text-emerald-700">{scanResult.action === 'time_in' ? 'Time In Successful' : 'Time Out Successful'}</p>
                      <p className="mt-2 text-3xl font-black text-slate-950">{scanResult.employee?.full_name}</p>
                      <p className="mt-2 text-base font-semibold text-slate-600">{scanResult.employee?.employee_code} · {formatTime(scanResult.time)}</p>
                    </>
                  ) : scanResult.type === 'warning' ? (
                    <>
                      <p className="text-xl font-black text-amber-900">{scanResult.title}</p>
                      <p className="mt-2 text-base font-semibold text-amber-800">{scanResult.message}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-black text-red-800">{scanResult.title || 'Unable to Record Attendance'}</p>
                      <p className="mt-2 text-sm font-semibold text-red-700">{scanResult.message}</p>
                    </>
                  )}
                </div>
              ) : null}

            </div>
          </section>
        )}
      </div>

      {showScanner && unlocked ? (
        <BarcodeScanner
          title={`${action === 'time_in' ? 'Time In' : 'Time Out'} · Scan Employee Barcode`}
          onDetected={(code) => { const clean = String(code || '').replace(/\D/g, '').slice(0, 10); setShowScanner(false); setBarcode(clean); window.setTimeout(() => submitScan(clean), 30) }}
          onClose={() => { setShowScanner(false); window.setTimeout(() => barcodeInputRef.current?.focus(), 50) }}
        />
      ) : null}
    </main>
  )
}

export default AttendanceKiosk
