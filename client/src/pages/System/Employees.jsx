import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiBriefcase, FiDollarSign, FiEdit2, FiPlus, FiRefreshCw, FiSearch, FiUsers } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import EmployeeModal from '../../components/System/employeeComponents/EmployeeModal'
import useCurrentUser from '../../utils/useCurrentUser'
import { useFetch, useFetchPatch } from '../../utils/useFetch'
import { PERMISSIONS, hasPermission } from '../../config/permissions'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const statusClass = { active: 'bg-emerald-50 text-emerald-700 ring-emerald-100', inactive: 'bg-amber-50 text-amber-700 ring-amber-100', archived: 'bg-slate-100 text-slate-600 ring-slate-200' }

const StatCard = ({ label, value, helper, icon: Icon }) => <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon /></span></div></div>

const Employees = () => {
  const queryClient = useQueryClient()
  const { data: currentUserData } = useCurrentUser()
  const canManage = hasPermission(currentUserData?.user, PERMISSIONS.EMPLOYEES_MANAGE)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [department, setDepartment] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [showEmployeeModal, setShowEmployeeModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search.trim()) params.set('search', search.trim())
    if (status !== 'all') params.set('status', status)
    if (department !== 'all') params.set('department', department)
    return params.toString()
  }, [department, limit, page, search, status])

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['employees', queryString],
    queryFn: () => useFetch(`/employees?${queryString}`),
    keepPreviousData: true,
  })

  const statusMutation = useMutation({
    mutationFn: ({ employeeId, employeeStatus }) => useFetchPatch(`/employees/${employeeId}/status`, { employee_status: employeeStatus }),
    onMutate: () => setAlert({ type: 'loading', message: 'Changing employee status...' }),
    onSuccess: (result) => { setAlert({ type: 'success', message: result?.message || 'Employee status updated.' }); queryClient.invalidateQueries({ queryKey: ['employees'] }) },
    onError: (mutationError) => setAlert({ type: 'error', message: mutationError?.message || 'Failed to change employee status.' }),
  })

  const employees = data?.data || []
  const summary = data?.summary || {}
  const pagination = data?.pagination || { page, totalPages: 1, total: 0 }
  const departments = data?.departments || []

  const openAdd = () => { setSelectedEmployee(null); setShowEmployeeModal(true) }
  const openEdit = (employee) => { setSelectedEmployee(employee); setShowEmployeeModal(true) }
  const changeStatus = (employee) => {
    const nextStatus = employee.employee_status === 'active' ? 'inactive' : 'active'
    if (!window.confirm(`Change ${employee.full_name} to ${nextStatus}?`)) return
    statusMutation.mutate({ employeeId: employee.employee_id, employeeStatus: nextStatus })
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader title="Employees" description="Employee profiles, monthly salaries, schedules, and employment status." icon={FiUsers} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"><FiRefreshCw className={isFetching ? 'animate-spin' : ''} />Refresh</button>
          {canManage ? <button type="button" onClick={openAdd} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700"><FiPlus />Add Employee</button> : null}
        </div>
      </div>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading employees..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load employees.'} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Employees" value={summary.total || 0} helper="All employee records" icon={FiUsers} />
        <StatCard label="Active" value={summary.active || 0} helper="Currently employed" icon={FiBriefcase} />
        <StatCard label="Inactive" value={summary.inactive || 0} helper="Temporarily inactive" icon={FiUsers} />
        <StatCard label="Monthly Payroll" value={money(summary.monthlyPayroll)} helper="Active base salaries" icon={FiDollarSign} />
        <StatCard label="New This Month" value={summary.newThisMonth || 0} helper="Recent hires" icon={FiPlus} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_190px_220px_auto]">
          <label className="relative"><FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search employee name, code, position, department..." className="h-11 w-full rounded-xl border border-slate-300 pl-11 pr-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select>
          <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"><option value="all">All Departments</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <button type="button" onClick={() => { setSearch(''); setStatus('all'); setDepartment('all'); setPage(1); setAlert({ type: 'info', message: 'Employee filters reset.' }) }} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50">Reset</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1150px] w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50"><tr>{['Employee', 'Position', 'Department', 'Monthly Salary', 'Schedule', 'Payroll Benefits', 'Type', 'Status', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {!isLoading && employees.length === 0 ? <tr><td colSpan={9} className="px-6 py-14 text-center text-sm font-semibold text-slate-500">No employee records match the selected filters.</td></tr> : null}
              {employees.map((employee) => {
                const firstSchedule = employee.schedules?.find((item) => item.is_work_day)
                return <tr key={employee.employee_id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4"><p className="font-black text-slate-950">{employee.full_name}</p><p className="mt-1 text-xs font-semibold text-blue-600">{employee.employee_code}</p><p className="text-xs text-slate-500">{employee.email || 'No email'}</p></td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{employee.position}</td>
                  <td className="px-4 py-4 text-slate-600">{employee.department || '-'}</td>
                  <td className="px-4 py-4 font-black text-slate-900">{money(employee.monthly_salary)}<p className="mt-1 max-w-[190px] text-xs font-semibold text-slate-500">Daily rate uses the scheduled work days in each salary month.</p></td>
                  <td className="px-4 py-4"><p className="font-semibold text-slate-700">{firstSchedule ? `${firstSchedule.shift_start?.slice(0, 5)}–${firstSchedule.shift_end?.slice(0, 5)}` : 'No schedule'}</p><p className="mt-1 text-xs text-slate-500">{(employee.work_days || []).map((day) => dayNames[day]).join(', ') || '-'}</p></td>
                  <td className="px-4 py-4 text-slate-600"><p className="font-black text-slate-800">{employee.attendance_grace_minutes} min bonus grace</p><p className="mt-1 text-xs">Rice per release: {money(employee.rice_allowance)}</p><p className="text-xs">7th transpo: {money(employee.transportation_allowance)}</p><p className="text-xs">7th bonus: {money(employee.attendance_bonus_amount)}</p></td>
                  <td className="px-4 py-4 capitalize text-slate-600">{String(employee.employment_type || '').replace('_', ' ')}</td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${statusClass[employee.employee_status] || statusClass.inactive}`}>{employee.employee_status}</span></td>
                  <td className="px-4 py-4"><div className="flex gap-2">{canManage ? <><button type="button" onClick={() => openEdit(employee)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"><FiEdit2 />Edit</button><button type="button" onClick={() => changeStatus(employee)} disabled={statusMutation.isPending || employee.employee_status === 'archived'} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">{employee.employee_status === 'active' ? 'Deactivate' : 'Activate'}</button></> : <span className="text-xs font-semibold text-slate-400">View only</span>}</div></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} employees</p><div className="flex items-center gap-2"><select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><button disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black disabled:opacity-50">Prev</button><button disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black disabled:opacity-50">Next</button></div></div>
      </section>

      {showEmployeeModal && canManage ? <EmployeeModal employee={selectedEmployee} onClose={() => setShowEmployeeModal(false)} onSaved={(message) => setAlert({ type: 'success', message })} /> : null}
    </main>
  )
}

export default Employees

