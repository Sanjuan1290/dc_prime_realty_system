import { useMemo, useState } from 'react'
import { FiDownload, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch } from '../../../utils/useFetch'
import { downloadAttendanceWorkbook } from '../../../utils/attendanceExcelExport'

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

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

const AttendanceExportModal = ({ onClose }) => {
  const initialMonth = getManilaMonth()
  const [month, setMonth] = useState(initialMonth)
  const [mode, setMode] = useState('first')
  const [customFrom, setCustomFrom] = useState(`${initialMonth}-01`)
  const [customTo, setCustomTo] = useState(`${initialMonth}-15`)
  const [notice, setNotice] = useState(null)
  const [isExporting, setIsExporting] = useState(false)

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

    setIsExporting(true)
    setNotice({ type: 'loading', message: 'Preparing all active employees and attendance records...' })
    try {
      const query = new URLSearchParams({ dateFrom: range.dateFrom, dateTo: range.dateTo }).toString()
      const result = await useFetch(`/attendance/export-data?${query}`, { timeoutMs: 120000 })
      const filename = downloadAttendanceWorkbook(result, { cutoffLabel: range.cutoffLabel })
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

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
            <p className="font-black">Excel rules</p>
            <p className="mt-1">Scheduled Time In 9:00 AM · Scheduled Time Out 8:00 PM · Break 1 hour · Regular Working Hour 11 hours. After 9:00 AM is Late; after 9:15 AM the row is highlighted red. Work on an employee Rest Day is reported as RD OT.</p>
          </div>
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
