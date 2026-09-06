import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiCalendar,
  FiCamera,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEdit2,
  FiLogIn,
  FiLogOut,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import AttendanceCorrectionModal from '../../components/System/employeeComponents/AttendanceCorrectionModal'
import AttendanceEventModal from '../../components/System/employeeComponents/AttendanceEventModal'
import BarcodeScanner from '../../components/System/employeeComponents/BarcodeScanner'
import useCurrentUser from '../../utils/useCurrentUser'
import { useFetch, useFetchDelete, useFetchPost, useFetchPut } from '../../utils/useFetch'
import { PERMISSIONS, hasPermission } from '../../config/permissions'

const getManilaParts = (date = new Date()) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).formatToParts(date).reduce((acc, part) => { if (part.type !== 'literal') acc[part.type] = part.value; return acc }, {})

const getManilaDate = () => {
  const parts = getManilaParts()
  return `${parts.year}-${parts.month}-${parts.day}`
}

const formatTime = (value) => {
  if (!value) return '—'
  const [hourRaw, minute] = String(value).slice(0, 5).split(':').map(Number)
  const hour = hourRaw % 12 || 12
  return `${hour}:${String(minute).padStart(2, '0')} ${hourRaw >= 12 ? 'PM' : 'AM'}`
}


const getScanProblem = (error) => {
  const code = String(error?.code || '')
  if (code === 'ALREADY_TIMED_IN') return { type: 'warning', title: 'Already Timed In', message: error?.message }
  if (code === 'ALREADY_TIMED_OUT') return { type: 'warning', title: 'Already Timed Out', message: error?.message }
  if (code === 'TIME_IN_REQUIRED') return { type: 'warning', title: 'Time In Required', message: error?.message }
  if (Number(error?.status) === 404) return { type: 'error', title: 'Employee Not Found', message: error?.message || 'No active employee matches that barcode code.' }
  return { type: 'error', title: 'Unable to Record Attendance', message: error?.message || 'Attendance scan failed.' }
}

const formatSelectedDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return value || '—'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

const dayTypeLabel = {
  regular: 'Regular Day',
  double_pay: 'Double Pay Day',
  regular_holiday: 'Regular Holiday',
  special_holiday: 'Special Holiday',
  company_event: 'Company Event',
}

const sourceTone = {
  Barcode: 'bg-blue-50 text-blue-700 ring-blue-200',
  'Manual Entry': 'bg-slate-100 text-slate-700 ring-slate-200',
  'Admin Correction': 'bg-amber-50 text-amber-700 ring-amber-200',
  'Company Event': 'bg-violet-50 text-violet-700 ring-violet-200',
  'Auto Time Out': 'bg-orange-50 text-orange-700 ring-orange-200',
}

const dayTone = {
  regular: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  double_pay: 'border-amber-300 bg-amber-50 text-amber-900',
  regular_holiday: 'border-blue-300 bg-blue-50 text-blue-900',
  special_holiday: 'border-rose-300 bg-rose-50 text-rose-900',
  company_event: 'border-violet-300 bg-violet-50 text-violet-900',
}

const shiftMonth = (month, offset) => {
  const [year, monthNumber] = String(month).split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

const monthTitle = (month) => {
  const [year, monthNumber] = String(month).split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}

const buildCalendarCells = (month) => {
  const [year, monthNumber] = String(month).split('-').map(Number)
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDay + 1
    if (day < 1 || day > daysInMonth) return null
    return {
      day,
      date: `${month}-${String(day).padStart(2, '0')}`,
    }
  })
}

const dateFallsWithinEvent = (date, event) => date >= String(event.start_date || '').slice(0, 10) && date <= String(event.end_date || '').slice(0, 10)

const Attendance = () => {
  const { data: currentUserData } = useCurrentUser()
  const canManage = hasPermission(currentUserData?.user, PERMISSIONS.ATTENDANCE_MANAGE)
  const queryClient = useQueryClient()
  const barcodeInputRef = useRef(null)
  const today = getManilaDate()
  const [selectedDate, setSelectedDate] = useState(today)
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7))
  const [action, setAction] = useState('time_in')
  const [barcode, setBarcode] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [alert, setAlert] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const [correctionRecord, setCorrectionRecord] = useState(null)
  const [showCorrection, setShowCorrection] = useState(false)
  const [eventRecord, setEventRecord] = useState(null)
  const [showEvent, setShowEvent] = useState(false)
  const [dayType, setDayType] = useState('regular')
  const [dayNotes, setDayNotes] = useState('')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const queryString = useMemo(() => new URLSearchParams({
    page: String(page), limit: String(limit), dateFrom: selectedDate, dateTo: selectedDate,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status !== 'all' ? { status } : {}),
  }).toString(), [page, limit, selectedDate, search, status])

  const attendanceQuery = useQuery({ queryKey: ['attendance', queryString], queryFn: () => useFetch(`/attendance?${queryString}`), keepPreviousData: true })
  const employeesQuery = useQuery({ queryKey: ['employees', 'attendance-options'], queryFn: () => useFetch('/employees?status=active&limit=100') })
  const eventsQuery = useQuery({ queryKey: ['attendance-events', selectedDate], queryFn: () => useFetch(`/attendance/events?dateFrom=${selectedDate}&dateTo=${selectedDate}`) })
  const calendarQuery = useQuery({ queryKey: ['attendance-calendar', calendarMonth], queryFn: () => useFetch(`/attendance/calendar?month=${calendarMonth}`), keepPreviousData: true })

  const rows = attendanceQuery.data?.data || []
  const summary = attendanceQuery.data?.summary || { present: 0, inOffice: 0, timedOut: 0, eventParticipants: 0, automaticTimeOuts: 0 }
  const pagination = attendanceQuery.data?.pagination || { page, totalPages: 1, total: 0, hasPrev: false, hasNext: false }
  const employees = employeesQuery.data?.data || []
  const events = eventsQuery.data?.data || []
  const defaultTimeOut = attendanceQuery.data?.settings?.defaultTimeOut || '20:00:00'

  useEffect(() => {
    if (eventsQuery.isLoading) return
    const day = attendanceQuery.data?.day
    if (events.length) {
      setDayType('company_event')
      setDayNotes(day?.notes || '')
      return
    }
    setDayType(day?.day_type || 'regular')
    setDayNotes(day?.notes || '')
  }, [selectedDate, eventsQuery.isLoading, eventsQuery.data, attendanceQuery.data?.day?.attendance_date, attendanceQuery.data?.day?.day_type, attendanceQuery.data?.day?.notes])

  const invalidateAttendance = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] })
    queryClient.invalidateQueries({ queryKey: ['attendance-events'] })
    queryClient.invalidateQueries({ queryKey: ['attendance-calendar'] })
  }

  const scanMutation = useMutation({
    mutationFn: ({ code }) => useFetchPost('/attendance/scan', { barcode_code: code, action }, { confirmationHandled: 'technical' }),
    onMutate: () => { setAlert({ type: 'loading', message: action === 'time_in' ? 'Recording Time In...' : 'Recording Time Out...' }); setScanResult(null) },
    onSuccess: (result) => {
      const data = result.data || {}
      setAlert(null)
      setScanResult({ type: 'success', action: data.action, employee: data.employee, time: data.time, message: result.message })
      setBarcode('')
      if (data.date) {
        setSelectedDate(data.date)
        setCalendarMonth(data.date.slice(0, 7))
        setPage(1)
      }
      invalidateAttendance()
      setTimeout(() => barcodeInputRef.current?.focus(), 50)
    },
    onError: (error) => { setAlert(null); setScanResult(getScanProblem(error)); setBarcode(''); setTimeout(() => barcodeInputRef.current?.focus(), 50) },
  })

  const dayMutation = useMutation({
    mutationFn: async () => {
      if (events.length) {
        for (const event of events) {
          await useFetchDelete(`/attendance/events/${event.attendance_event_id}`, { confirmationHandled: 'technical' })
        }
      }
      return useFetchPut(`/attendance/day/${selectedDate}`, { day_type: dayType, notes: dayNotes }, { confirmationHandled: 'compact' })
    },
    onMutate: () => setAlert({ type: 'loading', message: events.length ? 'Removing company event and saving day details...' : 'Saving day details...' }),
    onSuccess: (result) => { setAlert({ type: 'success', message: result.message || 'Date details updated.' }); invalidateAttendance() },
    onError: (error) => setAlert({ type: 'error', message: error.message }),
  })

  const deleteAttendanceMutation = useMutation({
    mutationFn: (record) => useFetchDelete(`/attendance/${record.employee_attendance_id}`, { confirmationHandled: 'compact' }),
    onSuccess: (result) => { setAlert({ type: 'success', message: result.message }); invalidateAttendance() },
    onError: (error) => setAlert({ type: 'error', message: error.message }),
  })

  const deleteEventMutation = useMutation({
    mutationFn: (event) => useFetchDelete(`/attendance/events/${event.attendance_event_id}`, { confirmationHandled: 'compact' }),
    onSuccess: (result) => { setAlert({ type: 'success', message: result.message }); invalidateAttendance() },
    onError: (error) => setAlert({ type: 'error', message: error.message }),
  })

  const submitScan = (explicitCode = '') => {
    const code = String(explicitCode || barcode).trim()
    if (!code) { setScanResult({ type: 'error', message: 'Scan or enter the employee barcode code first.' }); barcodeInputRef.current?.focus(); return }
    if (scanMutation.isPending) return
    scanMutation.mutate({ code })
  }

  const openCompanyEvent = (event = null) => {
    setEventRecord(event || events[0] || null)
    setShowEvent(true)
  }

  const saveDateDetails = () => {
    if (dayType === 'company_event') {
      openCompanyEvent()
      return
    }
    if (events.length) {
      const eventNames = events.map((event) => event.event_name).join(', ')
      const confirmed = window.confirm(`Change ${selectedDate} from Company Event to ${dayTypeLabel[dayType]}? This will remove ${eventNames} and the attendance records generated by the event.`)
      if (!confirmed) return
    }
    dayMutation.mutate()
  }

  const changeCalendarMonth = (offset) => {
    const nextMonth = shiftMonth(calendarMonth, offset)
    setCalendarMonth(nextMonth)
    setSelectedDate(`${nextMonth}-01`)
    setPage(1)
  }

  const selectCalendarDate = (date) => {
    setSelectedDate(date)
    setCalendarMonth(date.slice(0, 7))
    setPage(1)
  }

  const calendarCells = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth])
  const calendarDays = calendarQuery.data?.days || []
  const calendarEvents = calendarQuery.data?.events || []
  const calendarDayMap = useMemo(() => new Map(calendarDays.map((day) => [String(day.attendance_date).slice(0, 10), day])), [calendarDays])

  const manila = getManilaParts(now)
  const liveTime = formatTime(`${Number(manila.hour) === 24 ? '00' : manila.hour}:${manila.minute}:${manila.second}`)
  const liveDate = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now)

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title="Attendance" description="Barcode Time In/Time Out, calendar-based day management, manual corrections, and attendance history." icon={FiClock} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { attendanceQuery.refetch(); calendarQuery.refetch() }} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"><FiRefreshCw className={attendanceQuery.isFetching || calendarQuery.isFetching ? 'animate-spin' : ''} />Refresh</button>
          {canManage ? <button type="button" onClick={() => { setCorrectionRecord(null); setShowCorrection(true) }} className="inline-flex h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700"><FiPlus />Manual Attendance</button> : null}
        </div>
      </div>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {attendanceQuery.isError ? <StatusAlert type="error" message={attendanceQuery.error?.message || 'Failed to load attendance.'} /> : null}
      {calendarQuery.isError ? <StatusAlert type="error" message={calendarQuery.error?.message || 'Failed to load attendance calendar.'} /> : null}

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-slate-300">{liveDate}</p><p className="mt-1 text-3xl font-black">{liveTime}</p></div><p className="text-xs font-semibold text-slate-400">Philippine Time · Asia/Manila</p></div>
          </div>
          <div className="grid gap-5 p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setAction('time_in')} className={`flex h-16 items-center justify-center gap-3 rounded-2xl border text-base font-black transition ${action === 'time_in' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-50' : 'border-slate-200 bg-white text-slate-500'}`}><FiLogIn className="h-5 w-5" />TIME IN</button>
              <button type="button" onClick={() => setAction('time_out')} className={`flex h-16 items-center justify-center gap-3 rounded-2xl border text-base font-black transition ${action === 'time_out' ? 'border-orange-300 bg-orange-50 text-orange-700 ring-4 ring-orange-50' : 'border-slate-200 bg-white text-slate-500'}`}><FiLogOut className="h-5 w-5" />TIME OUT</button>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input ref={barcodeInputRef} autoFocus value={barcode} onChange={(e) => setBarcode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitScan() } }} placeholder="Scan or enter employee barcode code" className="h-12 flex-1 rounded-xl border border-blue-200 bg-white px-4 font-mono text-base font-black uppercase outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                <button type="button" onClick={() => setShowScanner(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-black text-blue-700"><FiCamera />Scan with Camera</button>
                <button type="button" onClick={() => submitScan()} disabled={scanMutation.isPending} className="h-12 rounded-xl bg-blue-600 px-6 text-sm font-black text-white disabled:opacity-60">Submit</button>
              </div>
              <p className="mt-2 text-xs font-semibold text-blue-700">Use the laptop/desktop webcam, tablet, or phone camera to scan the generated employee barcode. Manual entry and USB/Bluetooth barcode scanners remain available as fallbacks.</p>
            </div>

            {scanResult ? <div className={`rounded-2xl border p-5 ${scanResult.type === 'success' ? 'border-emerald-200 bg-emerald-50' : scanResult.type === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>{scanResult.type === 'success' ? <><p className="text-sm font-black uppercase tracking-wide text-emerald-700">{scanResult.action === 'time_in' ? 'Time In Successful' : 'Time Out Successful'}</p><p className="mt-1 text-xl font-black text-slate-950">{scanResult.employee?.full_name}</p><p className="mt-1 text-sm font-semibold text-slate-600">{scanResult.employee?.employee_code} · {formatTime(scanResult.time)}</p></> : scanResult.type === 'warning' ? <><p className="font-black text-amber-900">{scanResult.title}</p><p className="mt-1 text-sm font-semibold text-amber-800">{scanResult.message}</p></> : <><p className="font-black text-red-800">{scanResult.title || 'Unable to Record Attendance'}</p><p className="mt-1 text-sm font-semibold text-red-700">{scanResult.message}</p></>}</div> : null}
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Automatic Time Out</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{formatTime(defaultTimeOut)}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Employees who Time In but forget to Time Out are closed automatically at this time. Change it in System Settings.</p>
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Day Management</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Use the attendance calendar below to update Regular, Double Pay, Holiday, or Company Event dates—even if the admin forgot to classify the date earlier.</p>
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.65fr_.85fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
            <button type="button" onClick={() => changeCalendarMonth(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200" aria-label="Previous month"><FiChevronLeft /></button>
            <div className="text-center"><h2 className="text-lg font-black text-slate-950">{monthTitle(calendarMonth)}</h2><p className="mt-1 text-xs font-semibold text-slate-500">Attendance Calendar</p></div>
            <button type="button" onClick={() => changeCalendarMonth(1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200" aria-label="Next month"><FiChevronRight /></button>
          </div>

          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-2 pb-2 text-center text-xs font-black text-slate-500">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="py-2">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((cell, index) => {
                if (!cell) return <div key={`empty-${index}`} className="min-h-24 rounded-2xl border border-transparent sm:min-h-28" />
                const daySetting = calendarDayMap.get(cell.date)
                const dayEvents = calendarEvents.filter((event) => dateFallsWithinEvent(cell.date, event))
                const firstEvent = dayEvents[0]
                const visualType = dayEvents.length ? 'company_event' : (daySetting?.day_type || 'regular')
                const isSelected = selectedDate === cell.date
                const isToday = today === cell.date
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => selectCalendarDate(cell.date)}
                    className={`relative min-h-24 rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-28 sm:p-3 ${dayTone[visualType] || dayTone.regular} ${isSelected ? 'ring-4 ring-blue-100 border-blue-500' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-black ${isToday ? 'bg-blue-600 text-white' : 'bg-white/80 text-slate-900'}`}>{cell.day}</span>
                      {dayEvents.length > 1 ? <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-black text-violet-700">{dayEvents.length} events</span> : null}
                    </div>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-wide sm:text-xs">{dayTypeLabel[visualType]}</p>
                    {firstEvent ? <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-violet-700 sm:text-xs">{firstEvent.event_name}</p> : null}
                    {firstEvent?.day_type === 'double_pay' ? <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-800">DOUBLE PAY</span> : null}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-wide text-slate-400">Date Details</p><h2 className="mt-1 text-lg font-black text-slate-950">{formatSelectedDate(selectedDate)}</h2></div>
            {dayType === 'double_pay' ? <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-white">DOUBLE PAY</span> : dayType === 'company_event' ? <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-black text-white">EVENT</span> : null}
          </div>

          {canManage ? (
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Day Type</span><select value={dayType} onChange={(e) => setDayType(e.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold"><option value="regular">Regular Day</option><option value="double_pay">Double Pay Day</option><option value="regular_holiday">Regular Holiday</option><option value="special_holiday">Special Holiday</option><option value="company_event">Company Event</option></select></label>

              {dayType !== 'company_event' ? <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Note <span className="font-semibold text-slate-400">(optional)</span></span><textarea rows={3} value={dayNotes} onChange={(e) => setDayNotes(e.target.value)} placeholder="Optional note for this date" className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label> : null}

              {dayType === 'company_event' ? (
                <div className="grid gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  {events.length ? events.map((event) => (
                    <div key={event.attendance_event_id} className="rounded-xl border border-violet-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{event.event_name}</p><p className="mt-1 text-xs font-semibold text-slate-500">{event.location || 'No location'} · {event.participant_count} participant{event.participant_count === 1 ? '' : 's'}</p></div>{event.day_type === 'double_pay' ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">DOUBLE PAY</span> : null}</div>
                      <p className="mt-2 text-xs font-semibold text-slate-600">{event.attendance_treatment === 'record_only' ? 'Attendance Record Only' : event.attendance_treatment === 'full_day' ? 'Full Day Present' : 'Custom Time'}{event.event_time_in ? ` · ${formatTime(event.event_time_in)}–${formatTime(event.event_time_out)}` : ''}</p>
                      {event.participants?.length ? <p className="mt-2 text-xs font-semibold leading-5 text-violet-700">{event.participants.slice(0, 5).map((item) => item.full_name).join(', ')}{event.participants.length > 5 ? ` +${event.participants.length - 5} more` : ''}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => openCompanyEvent(event)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-3 text-xs font-black text-white"><FiEdit2 />Manage Event & Participants</button><button type="button" onClick={() => { if (window.confirm(`Remove company event \"${event.event_name}\" and its generated attendance records?`)) deleteEventMutation.mutate(event) }} className="h-9 rounded-lg bg-red-50 px-3 text-xs font-black text-red-700">Remove Event</button></div>
                    </div>
                  )) : <><p className="text-sm font-black text-violet-900">No company event has been configured for this date yet.</p><p className="text-xs font-semibold leading-5 text-violet-700">Set up the event to choose its name, location, attendance treatment, times, pay classification, and participating employees.</p></>}
                </div>
              ) : null}

              <button type="button" onClick={saveDateDetails} disabled={dayMutation.isPending} className={`h-11 rounded-xl px-4 text-sm font-black text-white disabled:opacity-60 ${dayType === 'company_event' ? 'bg-violet-600' : 'bg-slate-950'}`}>{dayType === 'company_event' ? (events.length ? 'Manage Company Event' : 'Set Up Company Event') : 'Save Changes'}</button>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-black text-slate-800">{dayTypeLabel[dayType] || dayType}</p>{dayNotes ? <p className="mt-2 text-sm font-semibold text-slate-600">{dayNotes}</p> : null}</div>
          )}
        </aside>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[['Present', summary.present, FiUsers], ['Currently In', summary.inOffice, FiLogIn], ['Timed Out', summary.timedOut, FiLogOut], ['Event Participants', summary.eventParticipants, FiCalendar], ['Auto Time Out', summary.automaticTimeOuts, FiClock]].map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><Icon className="text-slate-400" /></div><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>)}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-black text-slate-950">Attendance History</h2>
            <p className="text-xs font-semibold text-slate-500">
              Showing records for <span className="font-black text-slate-700">{formatSelectedDate(selectedDate)}</span>.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[170px_230px_180px]">
            <label className="grid gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const nextDate = e.target.value || today
                  setSelectedDate(nextDate)
                  setCalendarMonth(nextDate.slice(0, 7))
                  setPage(1)
                }}
                className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Search</span>
              <span className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search employee..."
                  className="h-10 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm font-semibold"
                />
              </span>
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Status</span>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold"
              >
                <option value="all">All Records</option>
                <option value="in_office">Currently In</option>
                <option value="timed_out">Timed Out</option>
                <option value="automatic">Auto Time Out</option>
                <option value="event">Company Event</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto"><table className="min-w-[1100px] w-full text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr>{['Employee', 'Department', 'Time In', 'Time Out', 'Source', 'Day Type', 'Status', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
          {attendanceQuery.isLoading ? <tr><td colSpan={8} className="px-6 py-16 text-center font-semibold text-slate-500">Loading attendance...</td></tr> : null}
          {!attendanceQuery.isLoading && rows.length === 0 ? <tr><td colSpan={8} className="px-6 py-16 text-center"><p className="font-black text-slate-800">No attendance records for this day</p><p className="mt-1 text-sm font-semibold text-slate-500">Barcode scans, manual entries, or company event attendance will appear here.</p></td></tr> : null}
          {rows.map((record) => {
            const source = record.source_label || 'Barcode'
            const complete = Boolean(record.actual_time_in && record.actual_time_out) || Boolean(record.attendance_event_id && !record.actual_time_in && !record.actual_time_out)
            return <tr key={record.employee_attendance_id} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-black text-slate-950">{record.full_name}</p><p className="text-xs font-semibold text-blue-600">{record.employee_code}</p>{record.event_name ? <p className="mt-1 text-xs font-semibold text-violet-600">{record.event_name}</p> : null}</td><td className="px-4 py-4 font-semibold text-slate-600">{record.department || '—'}</td><td className="px-4 py-4 font-black text-slate-900">{formatTime(record.actual_time_in)}{record.time_in_source === 'admin' ? <p className="text-xs font-semibold text-amber-600">Admin corrected</p> : null}</td><td className="px-4 py-4 font-black text-slate-900">{formatTime(record.actual_time_out)}{record.time_out_source === 'automatic' ? <p className="text-xs font-semibold text-orange-600">Automatic</p> : record.time_out_source === 'admin' ? <p className="text-xs font-semibold text-amber-600">Admin corrected</p> : null}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${sourceTone[source] || sourceTone.Barcode}`}>{source}</span></td><td className="px-4 py-4"><span className={`text-xs font-black ${record.day_type === 'double_pay' ? 'text-amber-700' : 'text-slate-600'}`}>{record.attendance_event_id ? `Company Event${record.day_type === 'double_pay' ? ' · Double Pay' : ''}` : (dayTypeLabel[record.day_type] || record.day_type)}</span></td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${complete ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{record.attendance_event_id && !record.actual_time_in ? 'Event Present' : complete ? 'Complete' : 'In Office'}</span></td><td className="px-4 py-4">{canManage ? <div className="flex gap-2"><button type="button" onClick={() => { setCorrectionRecord(record); setShowCorrection(true) }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-700"><FiEdit2 />Edit</button>{!record.attendance_event_id ? <button type="button" onClick={() => { if (window.confirm(`Delete ${record.full_name}'s attendance for ${selectedDate}?`)) deleteAttendanceMutation.mutate(record) }} className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700"><FiTrash2 /></button> : null}</div> : <span className="text-xs font-semibold text-slate-400">View only</span>}</td></tr>
          })}
        </tbody></table></div>
        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} records</p><div className="flex gap-2"><select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select><button disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black disabled:opacity-40">Prev</button><button disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black disabled:opacity-40">Next</button></div></div>
      </section>

      {showScanner ? <BarcodeScanner title={action === 'time_in' ? 'Scan Barcode for Time In' : 'Scan Barcode for Time Out'} onDetected={(code) => { setShowScanner(false); setBarcode(code.toUpperCase()); submitScan(code) }} onClose={() => setShowScanner(false)} /> : null}
      {showCorrection ? <AttendanceCorrectionModal record={correctionRecord} employees={employees} defaultDate={selectedDate} onClose={() => setShowCorrection(false)} onSaved={(message) => { setAlert({ type: 'success', message }); invalidateAttendance() }} /> : null}
      {showEvent ? <AttendanceEventModal event={eventRecord} employees={employees} defaultDate={selectedDate} onClose={() => setShowEvent(false)} onSaved={(message) => { setAlert({ type: 'success', message }); invalidateAttendance() }} /> : null}
    </main>
  )
}

export default Attendance
