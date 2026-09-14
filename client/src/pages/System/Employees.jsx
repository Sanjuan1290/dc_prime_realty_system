import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit2, FiPlus, FiRefreshCw, FiSearch, FiUsers } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import EmployeeModal from '../../components/System/employeeComponents/EmployeeModal'
import useCurrentUser from '../../utils/useCurrentUser'
import { useFetch, useFetchPatch } from '../../utils/useFetch'
import { PERMISSIONS, hasPermission } from '../../config/permissions'

const typeLabel = (value) => value === 'part_time' ? 'Part Time' : value === 'probationary' ? 'Probationary' : 'Full Time'
const restDayLabel = (days = []) => Array.isArray(days) && days.length
  ? days.map((day) => String(day).slice(0, 3).replace(/^./, (letter) => letter.toUpperCase())).join(', ')
  : 'Not set'

const statusTone = { active: 'bg-emerald-50 text-emerald-700 ring-emerald-200', inactive: 'bg-slate-100 text-slate-600 ring-slate-200' }

const Employees = () => {
  const { data: currentUserData } = useCurrentUser()
  const canManage = hasPermission(currentUserData?.user, PERMISSIONS.EMPLOYEES_MANAGE)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [department, setDepartment] = useState('all')
  const [employmentType, setEmploymentType] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const queryString = useMemo(() => new URLSearchParams({
    page: String(page), limit: String(limit),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(department !== 'all' ? { department } : {}),
    ...(employmentType !== 'all' ? { employmentType } : {}),
  }).toString(), [page, limit, search, status, department, employmentType])

  const employeesQuery = useQuery({ queryKey: ['employees', queryString], queryFn: () => useFetch(`/employees?${queryString}`), keepPreviousData: true })
  const rows = employeesQuery.data?.data || []
  const summary = employeesQuery.data?.summary || { total: 0, active: 0, inactive: 0 }
  const departments = employeesQuery.data?.departments || []
  const departmentConfigs = employeesQuery.data?.departmentConfigs || []
  const pagination = employeesQuery.data?.pagination || { page, totalPages: 1, total: 0, hasPrev: false, hasNext: false }

  const statusMutation = useMutation({
    mutationFn: (employee) => useFetchPatch(`/employees/${employee.employee_id}/status`, { employee_status: employee.employee_status === 'active' ? 'inactive' : 'active' }, { confirmationHandled: 'compact' }),
    onSuccess: (result) => { setAlert({ type: 'success', message: result.message }); queryClient.invalidateQueries({ queryKey: ['employees'] }) },
    onError: (error) => setAlert({ type: 'error', message: error.message }),
  })

  const openAdd = () => { setSelectedEmployee(null); setShowModal(true) }
  const openEdit = (employee) => { setSelectedEmployee(employee); setShowModal(true) }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title="Employees" description="Manage human Employee Codes, secure 10-digit Attendance Barcodes, departments, Rest Days, and employee status." icon={FiUsers} />
        <div className="flex gap-2">
          <button type="button" onClick={() => employeesQuery.refetch()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"><FiRefreshCw className={employeesQuery.isFetching ? 'animate-spin' : ''} />Refresh</button>
          {canManage ? <button type="button" onClick={openAdd} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700"><FiPlus />Add Employee</button> : null}
        </div>
      </div>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
      {employeesQuery.isError ? <StatusAlert type="error" message={employeesQuery.error?.message || 'Failed to load employees.'} /> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[['Total Employees', summary.total], ['Active', summary.active], ['Inactive', summary.inactive]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div>)}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-4">
          <label className="relative md:col-span-1"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search name, employee code, or attendance barcode..." className="h-10 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm font-semibold" /></label>
          <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1) }} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value="all">All Departments</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={employmentType} onChange={(e) => { setEmploymentType(e.target.value); setPage(1) }} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value="all">All Employment Types</option><option value="regular">Full Time</option><option value="probationary">Probationary</option><option value="part_time">Part Time</option></select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value="all">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1220px] w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50"><tr>{['Employee', 'Employee Code', 'Attendance Barcode', 'Department', 'Employment Type', 'Rest Days', 'Status', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {employeesQuery.isLoading ? <tr><td colSpan={8} className="px-6 py-16 text-center font-semibold text-slate-500">Loading employees...</td></tr> : null}
              {!employeesQuery.isLoading && rows.length === 0 ? <tr><td colSpan={8} className="px-6 py-16 text-center"><p className="font-black text-slate-800">No employees yet</p><p className="mt-1 text-sm font-semibold text-slate-500">Add the first employee. The system generates a department-based Employee Code and a separate secure 10-digit Attendance Barcode.</p></td></tr> : null}
              {rows.map((employee) => <tr key={employee.employee_id} className="hover:bg-slate-50">
                <td className="px-4 py-4"><p className="font-black text-slate-950">{employee.full_name}</p></td>
                <td className="px-4 py-4 font-mono font-black text-blue-700">{employee.employee_code}</td>
                <td className="px-4 py-4"><span className="rounded-lg bg-slate-950 px-2.5 py-1.5 font-mono text-xs font-black tracking-[0.12em] text-white">{employee.barcode_code || 'Not generated'}</span></td>
                <td className="px-4 py-4 font-semibold text-slate-700">{employee.department}</td>
                <td className="px-4 py-4 text-slate-600">{typeLabel(employee.employment_type)}</td>
                <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${employee.rest_days?.length ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>{restDayLabel(employee.rest_days)}</span></td>
                <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${statusTone[employee.employee_status] || statusTone.inactive}`}>{employee.employee_status}</span></td>
                <td className="px-4 py-4">{canManage ? <div className="flex gap-2"><button type="button" onClick={() => openEdit(employee)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700"><FiEdit2 />Edit</button><button type="button" onClick={() => statusMutation.mutate(employee)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">{employee.employee_status === 'active' ? 'Deactivate' : 'Activate'}</button></div> : <span className="text-xs font-semibold text-slate-400">View only</span>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} employees</p>
          <div className="flex gap-2"><select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><button disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black disabled:opacity-40">Prev</button><button disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black disabled:opacity-40">Next</button></div>
        </div>
      </section>

      {showModal ? <EmployeeModal employee={selectedEmployee} departmentConfigs={departmentConfigs} departments={departments} onClose={() => setShowModal(false)} onSaved={(message) => setAlert({ type: 'success', message })} /> : null}
    </main>
  )
}

export default Employees

