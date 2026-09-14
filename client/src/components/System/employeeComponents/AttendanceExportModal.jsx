import { useMemo, useState } from 'react'
import { FiDownload, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch } from '../../../utils/useFetch'
import { downloadAttendanceWorkbook } from '../../../utils/attendanceExcelExport'

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const getExportRulesFromSettings = (settings = {}) => ({
  scheduledTimeIn: String(settings.scheduledTimeIn || '09:00').slice(0, 5),
  scheduledTimeOut: String(settings.scheduledTimeOut || '20:00').slice(0, 5),
  breakStart: String(settings.breakStart || '12:00').slice(0, 5),
  breakMinutes: String(settings.breakMinutes ?? 60),
  regularWorkingHours: String(Number(settings.regularWorkingMinutes || 600) / 60),
  lateAfter: String(settings.lateAfter || '09:00').slice(0, 5),
  redHighlightAfter: String(settings.redHighlightAfter || '09:15').slice(0, 5),
})

const withSeconds = (value) => {
  const clean = String(value || '').trim()
  if (!clean) return ''
  return /^\d{2}:\d{2}$/.test(clean) ? `${clean}:00` : clean
}

const formatRuleTime = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/)
  if (!match) return value || '—'
  const hour = Number(match[1])
  const minute = match[2]
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${suffix}`
}

const getManilaMonth = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}`
}

const lastDayOfMonth = (month) => {
  const [year, monthNumber] = String(month).split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
}

const dateRangeForMode = ({ month, mode, customFrom, customTo }) => {
  if (mode === 'custom') {
    return {
      dateFrom: customFrom,
      dateTo: customTo,
      cutoffLabel: `${customFrom || 'Custom'} - ${customTo || ''}`,
    }
  }

  const lastDay = lastDayOfMonth(month)
  if (mode === 'second') {
    return {
      dateFrom: `${month}-16`,
      dateTo: `${month}-${String(lastDay).padStart(2, '0')}`,
      cutoffLabel: `16-${lastDay}`,
    }
  }

  return {
    dateFrom: `${month}-01`,
    dateTo: `${month}-15`,
    cutoffLabel: '1-15',
  }
}

const AttendanceExportModal = ({ onClose, attendanceSettings = {} }) => {
  const initialMonth = getManilaMonth()
  const [month, setMonth] = useState(initialMonth)
  const [mode, setMode] = useState('first')
  const [customFrom, setCustomFrom] = useState(`${initialMonth}-01`)
  const [customTo, setCustomTo] = useState(`${initialMonth}-15`)
  const [notice, setNotice] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const attendanceDefaults = useMemo(() => getExportRulesFromSettings(attendanceSettings), [attendanceSettings])
  const [rules, setRules] = useState(() => getExportRulesFromSettings(attendanceSettings))


  const range = useMemo(
    () => dateRangeForMode({ month, mode, customFrom, customTo }),
    [month, mode, customFrom, customTo]
  )

  const exportWorkbook = async () => {
    if (!range.dateFrom || !range.dateTo) {
      setNotice({ type: 'warning', message: 'Select a complete export date range.' })
      return
    }
    if (range.dateTo < range.dateFrom) {
      setNotice({ type: 'warning', message: 'Export end date cannot be before the start date.' })
      return
    }

    const breakMinutes = Number(rules.breakMinutes)
    const regularWorkingHours = Number(rules.regularWorkingHours)
    if (!rules.scheduledTimeIn || !rules.scheduledTimeOut || !rules.breakStart || !rules.lateAfter || !rules.redHighlightAfter) {
      setNotice({ type: 'warning', message: 'Complete all Excel rule time fields before exporting.' })
      return
    }
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0 || breakMinutes > 240) {
      setNotice({ type: 'warning', message: 'Break duration must be between 0 and 240 minutes.' })
      return
    }
    if (!Number.isFinite(regularWorkingHours) || regularWorkingHours <= 0 || regularWorkingHours > 24) {
      setNotice({ type: 'warning', message: 'Regular Working Hours must be greater than 0 and not more than 24.' })
      return
    }
    if (rules.redHighlightAfter < rules.lateAfter) {
      setNotice({ type: 'warning', message: 'Red-row highlight time cannot be earlier than the Late After time.' })
      return
    }

    setIsExporting(true)
    setNotice({ type: 'loading', message: 'Preparing all active employees and attendance records...' })
    try {
      const query = new URLSearchParams({ dateFrom: range.dateFrom, dateTo: range.dateTo }).toString()
      const result = await useFetch(`/attendance/export-data?${query}`, { timeoutMs: 120000 })
      const baseData = result?.data || result || {}
      const exportData = {
        ...baseData,
        schedule: {
          ...(baseData.schedule || {}),
          scheduledTimeIn: withSeconds(rules.scheduledTimeIn),
          scheduledTimeOut: withSeconds(rules.scheduledTimeOut),
          breakStart: withSeconds(rules.breakStart),
          breakMinutes,
          regularWorkingMinutes: Math.round(regularWorkingHours * 60),
          lateAfter: withSeconds(rules.lateAfter),
          redHighlightAfter: withSeconds(rules.redHighlightAfter),
        },
      }
      const filename = downloadAttendanceWorkbook(exportData, { cutoffLabel: range.cutoffLabel })
      setNotice({ type: 'success', message: `${filename} was generated successfully.` })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Attendance Excel export failed.' })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">Attendance Report</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Export Attendance Excel</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Downloads one workbook with one worksheet for every active employee. Rest Days and historical Rest Day changes are applied automatically.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isExporting} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40" aria-label="Close export modal"><FiX /></button>
        </header>

        <div className="grid gap-5 p-5 sm:p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} /> : null}

          <label className="grid gap-2">
            <span className="text-sm font-black text-slate-700">Month</span>
            <input type="month" value={month} onChange={(event) => {
              const next = event.target.value || initialMonth
              setMonth(next)
              setCustomFrom(`${next}-01`)
              setCustomTo(`${next}-15`)
              setNotice(null)
            }} className={inputClass} />
          </label>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-black text-slate-700">Cutoff Period</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ['first', '1 - 15'],
                ['second', `16 - ${lastDayOfMonth(month)}`],
                ['custom', 'Custom Range'],
              ].map(([value, label]) => (
                <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-black transition ${mode === value ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <input type="radio" name="attendance-export-range" value={value} checked={mode === value} onChange={() => { setMode(value); setNotice(null) }} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {mode === 'custom' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2"><span className="text-sm font-black text-slate-700">From</span><input type="date" value={customFrom} onChange={(event) => { setCustomFrom(event.target.value); setNotice(null) }} className={inputClass} /></label>
              <label className="grid gap-2"><span className="text-sm font-black text-slate-700">To</span><input type="date" value={customTo} onChange={(event) => { setCustomTo(event.target.value); setNotice(null) }} className={inputClass} /></label>
            </div>
          ) : null}

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-emerald-950">Excel rules</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">Defaults come from Attendance Settings. You can temporarily override them for this export without changing the saved Attendance Settings.</p>
              </div>
              <button type="button" onClick={() => { setRules(attendanceDefaults); setNotice(null) }} className="mt-2 text-xs font-black text-emerald-700 underline decoration-emerald-300 underline-offset-4 sm:mt-0">Reset to Attendance Settings</button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="grid gap-1.5"><span className="text-xs font-black text-emerald-950">Scheduled Time In</span><input type="time" value={rules.scheduledTimeIn} onChange={(event) => setRules((current) => ({ ...current, scheduledTimeIn: event.target.value }))} className={inputClass} /></label>
              <label className="grid gap-1.5"><span className="text-xs font-black text-emerald-950">Scheduled Time Out</span><input type="time" value={rules.scheduledTimeOut} onChange={(event) => setRules((current) => ({ ...current, scheduledTimeOut: event.target.value }))} className={inputClass} /></label>
              <label className="grid gap-1.5"><span className="text-xs font-black text-emerald-950">Regular Working Hours</span><input type="number" min="0.25" max="24" step="0.25" value={rules.regularWorkingHours} onChange={(event) => setRules((current) => ({ ...current, regularWorkingHours: event.target.value }))} className={inputClass} /></label>
              <label className="grid gap-1.5"><span className="text-xs font-black text-emerald-950">Break Start</span><input type="time" value={rules.breakStart} onChange={(event) => setRules((current) => ({ ...current, breakStart: event.target.value }))} className={inputClass} /></label>
              <label className="grid gap-1.5"><span className="text-xs font-black text-emerald-950">Break Duration (minutes)</span><input type="number" min="0" max="240" step="1" value={rules.breakMinutes} onChange={(event) => setRules((current) => ({ ...current, breakMinutes: event.target.value }))} className={inputClass} /></label>
              <label className="grid gap-1.5"><span className="text-xs font-black text-emerald-950">Late After</span><input type="time" value={rules.lateAfter} onChange={(event) => setRules((current) => ({ ...current, lateAfter: event.target.value }))} className={inputClass} /></label>
              <label className="grid gap-1.5"><span className="text-xs font-black text-emerald-950">Highlight Row Red After</span><input type="time" value={rules.redHighlightAfter} onChange={(event) => setRules((current) => ({ ...current, redHighlightAfter: event.target.value }))} className={inputClass} /></label>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-200 bg-white/80 px-3 py-2.5 text-xs font-semibold leading-5 text-emerald-900">
              Scheduled {formatRuleTime(rules.scheduledTimeIn)}–{formatRuleTime(rules.scheduledTimeOut)} · Break starts {formatRuleTime(rules.breakStart)} for {rules.breakMinutes || 0} min · Regular Working Hour {rules.regularWorkingHours || 0} hrs · Late after {formatRuleTime(rules.lateAfter)} · Red row after {formatRuleTime(rules.redHighlightAfter)} · Rest Day work = RD OT.
            </div>
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={isExporting} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={exportWorkbook} disabled={isExporting} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"><FiDownload />{isExporting ? 'Generating Excel...' : 'Download Excel'}</button>
        </footer>
      </section>
    </div>
  )
}

export default AttendanceExportModal
