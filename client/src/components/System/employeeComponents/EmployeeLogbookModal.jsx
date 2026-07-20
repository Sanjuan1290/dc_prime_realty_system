import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiDownload, FiFileText, FiPrinter, FiX } from 'react-icons/fi'
import * as XLSX from 'xlsx-js-style'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch } from '../../../utils/useFetch'
import { formatPayrollReleaseDate, isPayrollReleaseDate } from '../../../utils/payrollDates'

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const EmployeeLogbookModal = ({ employees = [], initialReleaseDate, onClose }) => {
  const [employeeId, setEmployeeId] = useState(String(employees[0]?.employee_id || ''))
  const [releaseDate, setReleaseDate] = useState(initialReleaseDate)
  const [notice, setNotice] = useState(null)

  const query = useQuery({
    queryKey: ['employee-logbook', employeeId, releaseDate],
    queryFn: () => useFetch(`/attendance/logbook?employeeId=${employeeId}&releaseDate=${releaseDate}`),
    enabled: Boolean(employeeId) && isPayrollReleaseDate(releaseDate),
  })

  const payload = query.data || {}
  const rows = payload.data || []
  const totals = payload.totals || {}
  const employee = payload.employee || {}
  const range = payload.range || {}

  const exportRows = useMemo(() => rows.map((row) => ({
    Day: row.day,
    Date: row.date,
    'Time IN': row.timeIn,
    'Time OUT': row.timeOut,
    'Total Hours Worked': row.totalHoursWorked,
    'Total Time Late': row.totalTimeLate,
    Overtime: row.overtime,
    'Regular Hours Attended': row.regularHoursAttended,
    Remarks: row.remarks,
  })), [rows])

  const exportWorkbook = () => {
    if (!rows.length) {
      setNotice({ type: 'warning', message: 'There are no logbook rows to export.' })
      return
    }

    setNotice({ type: 'loading', message: 'Preparing employee logbook export...' })

    try {
      const heading = [
        [employee.fullName || 'Employee'],
        [`Release: ${formatPayrollReleaseDate(range.releaseDate || releaseDate)} · Pay Period: ${range.shortLabel || '-'}`],
        [],
      ]
      const worksheet = XLSX.utils.aoa_to_sheet(heading)
      XLSX.utils.sheet_add_json(worksheet, exportRows, { origin: 'A4', skipHeader: false })
      XLSX.utils.sheet_add_aoa(worksheet, [
        [],
        ['ADJUSTMENTS'],
        ['No. of Days', totals.numberOfDays || 0, 'Total Hours Worked w/ OT', totals.totalHoursWorkedWithOvertime || '00:00:00'],
        ['No. of Hours', totals.numberOfHours || 0, 'Late', totals.late || '00:00:00'],
        ['', '', 'Overtime', totals.overtime || '00:00:00'],
        ['', '', 'Hours Attended', totals.hoursAttended || '00:00:00'],
        [],
        ['Employee ID', employee.employeeCode || '-'],
        ['Name of Employee', employee.fullName || '-'],
      ], { origin: `A${rows.length + 6}` })

      worksheet['!cols'] = [
        { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 21 },
        { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 27 },
      ]
      worksheet['!freeze'] = { xSplit: 0, ySplit: 4 }

      const headerRow = 4
      for (let column = 0; column < 9; column += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: headerRow - 1, c: column })
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '2F6B57' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } },
            },
          }
        }
      }

      if (worksheet.A1) worksheet.A1.s = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } }
      if (worksheet.A2) worksheet.A2.s = { font: { bold: true }, alignment: { horizontal: 'center' } }
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      ]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Office Logbook')
      XLSX.writeFile(workbook, `${employee.employeeCode || 'employee'}_${range.start || 'period'}_${range.end || 'period'}_logbook.xlsx`)
      setNotice({ type: 'success', message: 'Employee logbook exported successfully.' })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to export the logbook.' })
    }
  }

  const openPrint = () => {
    if (!employeeId || !isPayrollReleaseDate(releaseDate)) {
      setNotice({ type: 'warning', message: 'Select an employee and a release date on the 7th or 22nd.' })
      return
    }
    window.open(`/employee-payroll/logbook/print?employeeId=${employeeId}&releaseDate=${releaseDate}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><FiFileText /></span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black text-slate-950">Employee Office Logbook</h2>
              <p className="text-sm font-semibold text-slate-500">View, print, or export a 7th/22nd payroll-period attendance logbook.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"><FiX /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} className="mb-4" /> : null}

          <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_220px_auto_auto] lg:items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Employee</span>
              <select className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                {employees.map((item) => <option key={item.employee_id} value={item.employee_id}>{item.employee_code} · {item.full_name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-black text-slate-700">Salary Release Date</span>
              <input type="date" className={inputClass} value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} />
              {!isPayrollReleaseDate(releaseDate) ? <span className="text-xs font-semibold text-red-600">Choose a date on the 7th or 22nd.</span> : null}
            </label>
            <button type="button" onClick={exportWorkbook} disabled={query.isLoading || !rows.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"><FiDownload />Export Excel</button>
            <button type="button" onClick={openPrint} disabled={query.isLoading || !rows.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><FiPrinter />Print Logbook</button>
          </section>

          {query.isLoading ? <StatusAlert type="loading" message="Loading employee logbook..." className="mt-4" /> : null}
          {query.isError ? <StatusAlert type="error" message={query.error?.message || 'Failed to load the employee logbook.'} className="mt-4" /> : null}

          {!query.isLoading && !query.isError && rows.length ? (
            <>
              <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                <h3 className="text-xl font-black text-slate-950">{employee.fullName}</h3>
                <p className="mt-1 text-sm font-black text-slate-600">{range.releaseLabel} ({range.shortLabel})</p>
              </section>

              <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-[1150px] w-full text-sm">
                    <thead className="bg-emerald-800 text-white">
                      <tr>{['Day', 'Date', 'Time IN', 'Time OUT', 'Total Hours Worked', 'Total Time Late', 'Overtime', 'Regular Hours Attended', 'Remarks'].map((head) => <th key={head} className="px-3 py-3 text-center text-xs font-black uppercase tracking-wide">{head}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {rows.map((row) => (
                        <tr key={row.date} className={row.status === 'absent' || String(row.remarks).startsWith('Late') ? 'bg-red-50/50 text-red-700' : row.status === 'rest_day' ? 'bg-slate-50 text-slate-500' : 'text-slate-700'}>
                          <td className="px-3 py-3 text-center font-black">{row.day}</td>
                          <td className="px-3 py-3 text-center font-black">{row.date}</td>
                          <td className="px-3 py-3 text-center font-semibold">{row.timeIn}</td>
                          <td className="px-3 py-3 text-center font-semibold">{row.timeOut}</td>
                          <td className="px-3 py-3 text-center font-black">{row.totalHoursWorked}</td>
                          <td className="px-3 py-3 text-center font-black">{row.totalTimeLate}</td>
                          <td className="px-3 py-3 text-center font-black">{row.overtime}</td>
                          <td className="px-3 py-3 text-center font-black">{row.regularHoursAttended}</td>
                          <td className="px-3 py-3 text-center font-black">{row.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  ['No. of Days', totals.numberOfDays || 0],
                  ['No. of Hours', totals.numberOfHours || 0],
                  ['Worked w/ OT', totals.totalHoursWorkedWithOvertime || '00:00:00'],
                  ['Late', totals.late || '00:00:00'],
                  ['Overtime', totals.overtime || '00:00:00'],
                  ['Hours Attended', totals.hoursAttended || '00:00:00'],
                ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{value}</p></div>)}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default EmployeeLogbookModal


