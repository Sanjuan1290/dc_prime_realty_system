import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCalendar, FiClock, FiDollarSign, FiEdit2, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiUsers } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReadOnlyNotice from '../../components/Shared/ReadOnlyNotice'
import AttendanceModal from '../../components/System/employeeComponents/AttendanceModal'
import PayrollPreviewModal from '../../components/System/employeeComponents/PayrollPreviewModal'
import useCurrentUser from '../../utils/useCurrentUser'
import { useFetch, useFetchDelete } from '../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const statusTone = { present: 'bg-emerald-50 text-emerald-700', late: 'bg-amber-50 text-amber-700', absent: 'bg-red-50 text-red-700', paid_leave: 'bg-blue-50 text-blue-700', unpaid_leave: 'bg-orange-50 text-orange-700', rest_day: 'bg-slate-100 text-slate-600', holiday: 'bg-violet-50 text-violet-700', half_day: 'bg-cyan-50 text-cyan-700' }
const StatCard = ({ label, value, helper, icon: Icon }) => <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon /></span></div></div>

const Attendance = () => {
  const queryClient = useQueryClient()
  const { data: currentUserData } = useCurrentUser()
  const canManage = currentUserData?.user?.role === 'super_admin'
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10))
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(15)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  const [showPayroll, setShowPayroll] = useState(false)
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7))
  const [alert, setAlert] = useState(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), dateFrom, dateTo })
    if (search.trim()) params.set('search', search.trim())
    if (status !== 'all') params.set('status', status)
    return params.toString()
  }, [dateFrom, dateTo, limit, page, search, status])

  const attendanceQuery = useQuery({ queryKey: ['attendance', queryString], queryFn: () => useFetch(`/attendance?${queryString}`), keepPreviousData: true })
  const employeesQuery = useQuery({ queryKey: ['employee-options'], queryFn: () => useFetch('/employees?limit=100&status=active') })
  const deleteMutation = useMutation({
    mutationFn: (record) => useFetchDelete(`/attendance/${record.employee_attendance_id}`),
    onMutate: () => setAlert({ type: 'loading', message: 'Deleting attendance record...' }),
    onSuccess: (result) => { setAlert({ type: 'success', message: result?.message || 'Attendance record deleted.' }); queryClient.invalidateQueries({ queryKey: ['attendance'] }); queryClient.invalidateQueries({ queryKey: ['payroll-preview'] }) },
    onError: (error) => setAlert({ type: 'error', message: error?.message || 'Failed to delete attendance.' }),
  })

  const records = attendanceQuery.data?.data || []
  const summary = attendanceQuery.data?.summary || {}
  const pagination = attendanceQuery.data?.pagination || { page, totalPages: 1, total: 0 }
  const employees = employeesQuery.data?.data || []
  const openAdd = () => { setSelectedRecord(null); setShowAttendanceModal(true) }
  const openEdit = (record) => { setSelectedRecord(record); setShowAttendanceModal(true) }
  const removeRecord = (record) => { if (window.confirm(`Delete ${record.full_name}'s attendance for ${record.attendance_date}?`)) deleteMutation.mutate(record) }

  return <main className="flex flex-col gap-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><PageHeader title="Attendance" description="Daily time records, late seconds, undertime, and estimated salary deductions." icon={FiClock} /><div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => attendanceQuery.refetch()} disabled={attendanceQuery.isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"><FiRefreshCw className={attendanceQuery.isFetching ? 'animate-spin' : ''} />Refresh</button><button type="button" onClick={() => setShowPayroll(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700 hover:bg-emerald-100"><FiDollarSign />Payroll Preview</button>{canManage ? <button type="button" onClick={openAdd} disabled={!employees.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-blue-300"><FiPlus />Add Attendance</button> : null}</div></div>

    {!canManage ? <ReadOnlyNotice message="Admin can review attendance and payroll estimates. Only a Super Admin can add, edit, delete, or finalize records." /> : null}
    {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
    {attendanceQuery.isLoading ? <StatusAlert type="loading" message="Loading attendance records..." /> : null}
    {attendanceQuery.isError ? <StatusAlert type="error" message={attendanceQuery.error?.message || 'Failed to load attendance.'} /> : null}
    {employeesQuery.isError ? <StatusAlert type="warning" message={employeesQuery.error?.message || 'Failed to load employee options.'} /> : null}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <StatCard label="Records" value={summary.total || 0} helper="Selected dates" icon={FiCalendar} />
      <StatCard label="Present" value={summary.present || 0} helper="Present and late" icon={FiUsers} />
      <StatCard label="Late" value={summary.late || 0} helper="Late records" icon={FiClock} />
      <StatCard label="Absent" value={summary.absent || 0} helper="Unpaid absences" icon={FiUsers} />
      <StatCard label="Late Time" value={summary.lateDuration || '0s'} helper="Total late duration" icon={FiClock} />
      <StatCard label="Deductions" value={money(summary.estimatedDeductions)} helper="Attendance estimate" icon={FiDollarSign} />
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 lg:grid-cols-[1fr_170px_170px_190px_auto]">
      <label className="relative"><FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search employee name, code, department..." className="h-11 w-full rounded-xl border border-slate-300 pl-11 pr-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
      <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold" />
      <input type="date" value={dateTo} min={dateFrom} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold" />
      <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"><option value="all">All Status</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="half_day">Half Day</option><option value="paid_leave">Paid Leave</option><option value="unpaid_leave">Unpaid Leave</option><option value="rest_day">Rest Day</option><option value="holiday">Holiday</option></select>
      <button type="button" onClick={() => { const today = new Date().toISOString().slice(0, 10); setSearch(''); setStatus('all'); setDateFrom(today); setDateTo(today); setPage(1) }} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700 hover:bg-slate-50">Reset</button>
    </div></section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[1300px] w-full text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr>{['Date', 'Employee', 'Schedule', 'Actual Time', 'Late', 'Undertime', 'Status', 'Deduction', 'Recorded By', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
      {!attendanceQuery.isLoading && records.length === 0 ? <tr><td colSpan={10} className="px-6 py-14 text-center font-semibold text-slate-500">No attendance records found for the selected filters.</td></tr> : null}
      {records.map((record) => <tr key={record.employee_attendance_id} className="hover:bg-slate-50"><td className="px-4 py-4 font-black text-slate-800">{record.attendance_date}</td><td className="px-4 py-4"><p className="font-black">{record.full_name}</p><p className="text-xs text-blue-600">{record.employee_code}</p><p className="text-xs text-slate-500">{record.department || '-'}</p></td><td className="px-4 py-4 text-slate-600">{record.scheduled_time_in?.slice(0, 8) || '-'}–{record.scheduled_time_out?.slice(0, 8) || '-'}</td><td className="px-4 py-4"><p className="font-semibold text-slate-700">In: {record.actual_time_in?.slice(0, 8) || '-'}</p><p className="text-xs text-slate-500">Out: {record.actual_time_out?.slice(0, 8) || '-'}</p></td><td className="px-4 py-4"><p className="font-black text-amber-700">{record.late_duration}</p><p className="text-xs text-slate-500">{money(record.late_deduction)}</p></td><td className="px-4 py-4"><p className="font-black text-orange-700">{record.undertime_duration}</p><p className="text-xs text-slate-500">{money(record.undertime_deduction)}</p></td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black capitalize ${statusTone[record.attendance_status] || statusTone.present}`}>{String(record.attendance_status).replace('_', ' ')}</span></td><td className="px-4 py-4 font-black text-red-700">{money(Number(record.late_deduction) + Number(record.undertime_deduction) + Number(record.absence_deduction))}</td><td className="px-4 py-4 text-xs font-semibold text-slate-600">{record.recorded_by_name || '-'}</td><td className="px-4 py-4">{canManage ? <div className="flex gap-2"><button type="button" onClick={() => openEdit(record)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"><FiEdit2 />Edit</button><button type="button" onClick={() => removeRecord(record)} disabled={deleteMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-50"><FiTrash2 />Delete</button></div> : <span className="text-xs font-semibold text-slate-400">View only</span>}</td></tr>)}
    </tbody></table></div><div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} records</p><div className="flex gap-2"><select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value={15}>15</option><option value={30}>30</option><option value={50}>50</option></select><button disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black disabled:opacity-50">Prev</button><button disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black disabled:opacity-50">Next</button></div></div></section>

    {showAttendanceModal && canManage ? <AttendanceModal record={selectedRecord} employees={employees} onClose={() => setShowAttendanceModal(false)} onSaved={(message) => setAlert({ type: 'success', message })} /> : null}
    {showPayroll ? <PayrollPreviewModal month={payrollMonth} canFinalize={canManage} onClose={() => setShowPayroll(false)} onFinalized={(message) => setAlert({ type: 'success', message })} /> : null}

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex flex-1 flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Payroll Month</span><input type="month" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold" /></label><button type="button" onClick={() => setShowPayroll(true)} className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700">Open Payroll Preview</button></div></section>
  </main>
}

export default Attendance
