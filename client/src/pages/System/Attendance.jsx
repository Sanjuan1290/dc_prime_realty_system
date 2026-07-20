import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiDollarSign,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import AttendanceModal from '../../components/System/employeeComponents/AttendanceModal'
import EmployeeLogbookModal from '../../components/System/employeeComponents/EmployeeLogbookModal'
import PayrollPreviewModal from '../../components/System/employeeComponents/PayrollPreviewModal'
import useCurrentUser from '../../utils/useCurrentUser'
import { useFetch, useFetchDelete } from '../../utils/useFetch'
import { getNextPayrollReleaseDate } from '../../utils/payrollDates'
import { PERMISSIONS, hasPermission } from '../../config/permissions'

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
}).format(Number(value || 0))

const statusTone = {
  present: 'bg-emerald-50 text-emerald-700',
  late: 'bg-amber-50 text-amber-700',
  absent: 'bg-red-50 text-red-700',
  paid_leave: 'bg-blue-50 text-blue-700',
  unpaid_leave: 'bg-orange-50 text-orange-700',
  rest_day: 'bg-slate-100 text-slate-600',
  holiday: 'bg-violet-50 text-violet-700',
  regular_holiday: 'bg-violet-50 text-violet-700',
  special_holiday: 'bg-fuchsia-50 text-fuchsia-700',
  half_day: 'bg-cyan-50 text-cyan-700',
}

const StatCard = ({ label, value, helper, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
      </div>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon /></span>
    </div>
  </div>
)

const Attendance = () => {
  const queryClient = useQueryClient()
  const { data: currentUserData } = useCurrentUser()
  const canManage = hasPermission(currentUserData?.user?.role, PERMISSIONS.ATTENDANCE_MANAGE)
  const canFinalizePayroll = hasPermission(currentUserData?.user?.role, PERMISSIONS.PAYROLL_MANAGE)

  const today = new Date().toISOString().slice(0, 10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(15)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  const [showPayroll, setShowPayroll] = useState(false)
  const [showLogbook, setShowLogbook] = useState(false)
  const [payrollReleaseDate, setPayrollReleaseDate] = useState(getNextPayrollReleaseDate())
  const [alert, setAlert] = useState(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      dateFrom,
      dateTo,
    })
    if (search.trim()) params.set('search', search.trim())
    if (status !== 'all') params.set('status', status)
    return params.toString()
  }, [dateFrom, dateTo, limit, page, search, status])

  const attendanceQuery = useQuery({
    queryKey: ['attendance', queryString],
    queryFn: () => useFetch(`/attendance?${queryString}`),
    keepPreviousData: true,
  })

  const employeesQuery = useQuery({
    queryKey: ['employee-options'],
    queryFn: () => useFetch('/employees?limit=100&status=active'),
  })

  const deleteMutation = useMutation({
    mutationFn: (record) => useFetchDelete(`/attendance/${record.employee_attendance_id}`),
    onMutate: () => setAlert({ type: 'loading', message: 'Deleting attendance record...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Attendance record deleted.' })
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-preview'] })
      queryClient.invalidateQueries({ queryKey: ['employee-logbook'] })
    },
    onError: (error) => setAlert({ type: 'error', message: error?.message || 'Failed to delete attendance.' }),
  })

  const records = attendanceQuery.data?.data || []
  const summary = attendanceQuery.data?.summary || {}
  const pagination = attendanceQuery.data?.pagination || { page, totalPages: 1, total: 0 }
  const employees = employeesQuery.data?.data || []

  const openAdd = () => {
    setSelectedRecord(null)
    setShowAttendanceModal(true)
  }

  const openEdit = (record) => {
    setSelectedRecord(record)
    setShowAttendanceModal(true)
  }

  const removeRecord = (record) => {
    if (window.confirm(`Delete ${record.full_name}'s attendance for ${record.attendance_date}?`)) {
      deleteMutation.mutate(record)
    }
  }

  const resetFilters = () => {
    setSearch('')
    setStatus('all')
    setDateFrom(today)
    setDateTo(today)
    setPage(1)
    setAlert({ type: 'info', message: 'Attendance filters reset.' })
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          title="Attendance & Salary Release"
          description="Daily time records, office logbooks, semi-monthly payroll releases, allowances, and attendance bonuses."
          icon={FiClock}
        />

        <div className="grid gap-2 sm:grid-cols-2 xl:flex">
          <button
            type="button"
            onClick={() => attendanceQuery.refetch()}
            disabled={attendanceQuery.isFetching}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <FiRefreshCw className={attendanceQuery.isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowLogbook(true)}
            disabled={!employees.length}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
          >
            <FiBookOpen />
            Employee Logbook
          </button>
          <button
            type="button"
            onClick={() => setShowPayroll(true)}
            disabled={!employees.length}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            <FiDollarSign />
            Salary Release
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={openAdd}
              disabled={!employees.length}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:bg-blue-300"
            >
              <FiPlus />
              Add Attendance
            </button>
          ) : null}
        </div>
      </div>


      <StatusAlert
        type="info"
        message="Salary is released every 7th and 22nd. Every late second is deducted. A late entry within the employee's configured 15-minute bonus grace can still qualify for the 7th-day attendance bonus."
      />

      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
        />
      ) : null}
      {attendanceQuery.isLoading ? <StatusAlert type="loading" message="Loading attendance records..." /> : null}
      {attendanceQuery.isError ? <StatusAlert type="error" message={attendanceQuery.error?.message || 'Failed to load attendance.'} /> : null}
      {employeesQuery.isError ? <StatusAlert type="warning" message={employeesQuery.error?.message || 'Failed to load employee options.'} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Records" value={summary.total || 0} helper="Selected dates" icon={FiCalendar} />
        <StatCard label="Present" value={summary.present || 0} helper="Present and late" icon={FiUsers} />
        <StatCard label="Late" value={summary.late || 0} helper="All late records" icon={FiClock} />
        <StatCard label="Absent" value={summary.absent || 0} helper="Unpaid absences" icon={FiUsers} />
        <StatCard label="Late Time" value={summary.lateDuration || '0s'} helper="All late time is deductible" icon={FiClock} />
        <StatCard label="Deductions" value={money(summary.estimatedDeductions)} helper="Saved attendance estimate" icon={FiDollarSign} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_170px_170px_210px_auto]">
          <label className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Search employee name, code, or department..."
              className="h-11 w-full rounded-xl border border-slate-300 pl-11 pr-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </label>
          <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold" />
          <input type="date" value={dateTo} min={dateFrom} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold" />
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700">
            <option value="all">All Status</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="half_day">Half Day</option>
            <option value="paid_leave">Paid Leave</option>
            <option value="unpaid_leave">Unpaid Leave</option>
            <option value="rest_day">Rest Day</option>
            <option value="regular_holiday">Regular Holiday</option>
            <option value="special_holiday">Special Non-Working Holiday</option>
          </select>
          <button type="button" onClick={resetFilters} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50">Reset</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1450px] w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>{['Date', 'Employee', 'Schedule', 'Actual Time', 'Late', 'Undertime', 'Overtime', 'Bonus Grace', 'Status', 'Estimated Deduction', 'Recorded By', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!attendanceQuery.isLoading && records.length === 0 ? <tr><td colSpan={12} className="px-6 py-14 text-center font-semibold text-slate-500">No attendance records found for the selected filters.</td></tr> : null}
              {records.map((record) => {
                const attendanceDeduction = Number(record.late_deduction || 0) + Number(record.undertime_deduction || 0) + Number(record.absence_deduction || 0)
                return (
                  <tr key={record.employee_attendance_id} className="align-top transition hover:bg-slate-50">
                    <td className="px-4 py-4 font-black text-slate-800">{record.attendance_date}</td>
                    <td className="px-4 py-4"><p className="font-black text-slate-950">{record.full_name}</p><p className="text-xs font-semibold text-blue-600">{record.employee_code}</p><p className="text-xs text-slate-500">{record.department || '-'}</p></td>
                    <td className="px-4 py-4"><p className="font-semibold text-slate-700">{record.scheduled_time_in?.slice(0, 8) || '-'} – {record.scheduled_time_out?.slice(0, 8) || '-'}</p></td>
                    <td className="px-4 py-4"><p className="font-semibold text-slate-700">{record.actual_time_in?.slice(0, 8) || '-'} – {record.actual_time_out?.slice(0, 8) || '-'}</p></td>
                    <td className="px-4 py-4"><p className="font-black text-amber-700">{record.late_duration || '0s'}</p><p className="text-xs text-slate-500">{money(record.late_deduction)}</p></td>
                    <td className="px-4 py-4"><p className="font-black text-orange-700">{record.undertime_duration || '0s'}</p><p className="text-xs text-slate-500">{money(record.undertime_deduction)}</p></td>
                    <td className="px-4 py-4"><p className="font-black text-emerald-700">{record.overtime_duration || '0s'}</p></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${record.bonus_late_violation ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{record.bonus_late_violation ? 'Exceeded' : 'Eligible'}</span><p className="mt-1 text-xs text-slate-500">{record.attendance_grace_minutes ?? 15} min</p></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black capitalize ${statusTone[record.attendance_status] || statusTone.present}`}>{String(record.attendance_status || '').replaceAll('_', ' ')}</span></td>
                    <td className="px-4 py-4 font-black text-red-700">{money(attendanceDeduction)}</td>
                    <td className="px-4 py-4 text-slate-600">{record.recorded_by_name || '-'}</td>
                    <td className="px-4 py-4">
                      {canManage ? (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => openEdit(record)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100" aria-label="Edit attendance"><FiEdit2 /></button>
                          <button type="button" onClick={() => removeRecord(record)} disabled={deleteMutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-50" aria-label="Delete attendance"><FiTrash2 /></button>
                        </div>
                      ) : <span className="text-xs font-semibold text-slate-400">View only</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-500">Showing {records.length} of {pagination.total || 0} record(s).</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"><option value={10}>10 rows</option><option value={15}>15 rows</option><option value={25}>25 rows</option><option value={50}>50 rows</option></select>
            <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page <= 1} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-700 disabled:opacity-40">Previous</button>
            <span className="px-2 text-sm font-black text-slate-700">Page {page} of {pagination.totalPages || 1}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(current + 1, pagination.totalPages || 1))} disabled={page >= (pagination.totalPages || 1)} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-700 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      {showAttendanceModal ? (
        <AttendanceModal
          record={selectedRecord}
          employees={employees}
          onClose={() => setShowAttendanceModal(false)}
          onSaved={(message) => setAlert({ type: 'success', message })}
        />
      ) : null}

      {showPayroll ? (
        <PayrollPreviewModal
          releaseDate={payrollReleaseDate}
          canFinalize={canFinalizePayroll}
          onClose={() => setShowPayroll(false)}
          onFinalized={(message) => setAlert({ type: 'success', message })}
        />
      ) : null}

      {showLogbook ? (
        <EmployeeLogbookModal
          employees={employees}
          initialReleaseDate={payrollReleaseDate}
          onClose={() => setShowLogbook(false)}
        />
      ) : null}
    </main>
  )
}

export default Attendance


