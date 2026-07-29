import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import PrintPageShell from '../../../Lot_Projects/ListingProfileComponents/Printouts/PrintPageShell'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetch } from '../../../../utils/useFetch'

const formatDate = (value) => {
  if (!value) return '-'
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

const EmployeeLogbookPrintPage = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const employeeId = params.get('employeeId') || ''
  const releaseDate = params.get('releaseDate') || ''

  const query = useQuery({
    queryKey: ['employee-logbook-print', employeeId, releaseDate],
    queryFn: () => useFetch(`/attendance/logbook?employeeId=${employeeId}&releaseDate=${releaseDate}`),
    enabled: Boolean(employeeId && releaseDate),
  })

  const employee = query.data?.employee || {}
  const range = query.data?.range || {}
  const rows = query.data?.data || []
  const totals = query.data?.totals || {}

  return (
    <PrintPageShell title="Employee Office Logbook">
      {query.isLoading ? <div className="mx-auto max-w-4xl"><StatusAlert type="loading" message="Loading employee logbook..." /></div> : null}
      {query.isError ? <div className="mx-auto max-w-4xl"><StatusAlert type="error" message={query.error?.message || 'Failed to load employee logbook.'} /></div> : null}

      {!query.isLoading && !query.isError ? (
        <section className="print-page mx-auto min-h-[210mm] w-[297mm] bg-white px-[10mm] py-[9mm] text-[9px] text-slate-950 shadow-xl print:shadow-none">
          <header className="mb-2 text-center">
            <h1 className="text-[17px] font-black uppercase">{employee.fullName || 'Employee'}</h1>
            <p className="mt-1 text-[14px] font-black">{range.releaseLabel || formatDate(releaseDate)} ({range.shortLabel || '-'})</p>
            <p className="mt-1 font-semibold text-slate-600">Office Logbook · Employee ID: {employee.employeeCode || '-'}</p>
          </header>

          <table className="w-full table-fixed border-collapse border border-slate-700 text-center">
            <thead className="bg-emerald-900 text-[9px] font-black text-white">
              <tr>
                {['Day', 'Date', 'Time IN', 'Time OUT', 'Total Hours Worked', 'Total Time Late', 'Overtime', 'Regular Hours Attended', 'Remarks'].map((head, index) => (
                  <th key={head} className={`border border-slate-700 px-1.5 py-2 ${index < 4 ? 'w-[10%]' : index === 8 ? 'w-[11%]' : ''}`}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const attention = ['Late', 'Absent'].includes(row.remarks)
                return (
                  <tr key={row.date} className={attention ? 'font-black text-red-600' : 'font-semibold'}>
                    <td className="border border-slate-500 px-1 py-1.5 uppercase">{row.day}</td>
                    <td className="border border-slate-500 px-1 py-1.5">{formatDate(row.date)}</td>
                    <td className="border border-slate-500 px-1 py-1.5">{row.timeIn}</td>
                    <td className="border border-slate-500 px-1 py-1.5">{row.timeOut}</td>
                    <td className="border border-slate-500 px-1 py-1.5">{row.totalHoursWorked}</td>
                    <td className="border border-slate-500 px-1 py-1.5">{row.totalTimeLate}</td>
                    <td className="border border-slate-500 px-1 py-1.5">{row.overtime}</td>
                    <td className="border border-slate-500 px-1 py-1.5">{row.regularHoursAttended}</td>
                    <td className="border border-slate-500 px-1 py-1.5">{row.remarks}</td>
                  </tr>
                )
              })}
              {!rows.length ? <tr><td colSpan={9} className="border border-slate-500 px-4 py-10 font-semibold text-slate-500">No scheduled dates are available for this pay period.</td></tr> : null}
            </tbody>
            <tfoot className="bg-emerald-100 font-black">
              <tr><td colSpan={9} className="border border-slate-700 px-2 py-2">TOTAL</td></tr>
            </tfoot>
          </table>

          <section className="mt-3">
            <h2 className="text-center text-[14px] font-black">ADJUSTMENTS</h2>
            <div className="mt-2 grid grid-cols-5 gap-4 text-center">
              <div><p className="text-[11px] font-black">No. of Days</p><p className="mt-1 text-[14px] font-black">{totals.numberOfDays || 0}</p></div>
              <div><p className="text-[11px] font-black">No. of Hours</p><p className="mt-1 text-[14px] font-black">{totals.numberOfHours || 0}</p></div>
              <div><p className="text-[11px] font-black">Total Hours Worked w/ OT</p><p className="mt-1 text-[14px] font-black">{totals.totalHoursWorkedWithOvertime || '00:00:00'}</p></div>
              <div><p className="text-[11px] font-black">Late</p><p className="mt-1 text-[14px] font-black">{totals.late || '00:00:00'}</p></div>
              <div><p className="text-[11px] font-black">Overtime / Hours Attended</p><p className="mt-1 text-[14px] font-black">{totals.overtime || '00:00:00'} / {totals.hoursAttended || '00:00:00'}</p></div>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-[150px_1fr] gap-y-2 text-[11px]">
            <p className="text-right font-black">ID#:</p><p className="pl-5 font-black">{employee.employeeCode || '-'}</p>
            <p className="text-right font-black">Name of Employee:</p><p className="pl-5 font-black uppercase">{employee.fullName || '-'}</p>
            <p className="text-right font-black">Position:</p><p className="pl-5 font-black">{employee.position || '-'} · {employee.department || '-'}</p>
            <p className="text-right font-black">Signature:</p><div className="ml-5 h-6 border-b border-slate-800" />
            <p className="text-right font-black">Date:</p><p className="pl-5 font-black">{formatDate(range.releaseDate || releaseDate)}</p>
          </section>

          <p className="mt-5 text-center text-[8px] font-semibold text-slate-500">All tardiness is included in salary deductions. The employee grace setting applies only to attendance-bonus qualification.</p>
        </section>
      ) : null}
    </PrintPageShell>
  )
}

export default EmployeeLogbookPrintPage
