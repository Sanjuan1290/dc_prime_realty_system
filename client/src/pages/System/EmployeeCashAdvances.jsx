import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiCheckCircle, FiDollarSign, FiEye, FiPlus, FiRefreshCw, FiSearch, FiUsers } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReadOnlyNotice from '../../components/Shared/ReadOnlyNotice'
import CashAdvanceModal from '../../components/System/employeeComponents/CashAdvanceModal'
import CashAdvanceDetailsModal from '../../components/System/employeeComponents/CashAdvanceDetailsModal'
import useCurrentUser from '../../utils/useCurrentUser'
import { useFetch } from '../../utils/useFetch'
import { isFullAccessAdministrator } from '../../config/permissions'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const statusTone = { pending: 'bg-amber-50 text-amber-700', approved: 'bg-blue-50 text-blue-700', active: 'bg-blue-50 text-blue-700', paid: 'bg-emerald-50 text-emerald-700', rejected: 'bg-red-50 text-red-700', cancelled: 'bg-slate-100 text-slate-600' }
const StatCard = ({ label, value, helper, icon: Icon }) => <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Icon /></span></div></div>

const EmployeeCashAdvances = () => {
  const { data: currentUserData } = useCurrentUser()
  const canManage = isFullAccessAdministrator(currentUserData?.user)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [showModal, setShowModal] = useState(false)
  const [selectedAdvance, setSelectedAdvance] = useState(null)
  const [detailsId, setDetailsId] = useState(null)
  const [alert, setAlert] = useState(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search.trim()) params.set('search', search.trim())
    if (status !== 'all') params.set('status', status)
    return params.toString()
  }, [limit, page, search, status])

  const advancesQuery = useQuery({ queryKey: ['employee-cash-advances', queryString], queryFn: () => useFetch(`/employee-cash-advances?${queryString}`), keepPreviousData: true })
  const employeesQuery = useQuery({ queryKey: ['employee-options'], queryFn: () => useFetch('/employees?limit=100&status=active') })
  const rows = advancesQuery.data?.data || []
  const summary = advancesQuery.data?.summary || {}
  const pagination = advancesQuery.data?.pagination || { page, totalPages: 1, total: 0 }
  const employees = employeesQuery.data?.data || []

  const openAdd = () => { setSelectedAdvance(null); setShowModal(true) }
  const openEdit = (advance) => { setSelectedAdvance(advance); setShowModal(true) }

  return <main className="flex flex-col gap-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><PageHeader title="Employee Cash Advances" description="Salary cash advances, approvals, automatic next-release deductions, and balance history." icon={FiDollarSign} /><div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => advancesQuery.refetch()} disabled={advancesQuery.isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"><FiRefreshCw className={advancesQuery.isFetching ? 'animate-spin' : ''} />Refresh</button>{canManage ? <button type="button" onClick={openAdd} disabled={!employees.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-blue-300"><FiPlus />Add Cash Advance</button> : null}</div></div>

    {!canManage ? <ReadOnlyNotice message="This account can review employee salary advances but cannot change them." /> : null}
    <StatusAlert type="info" message="Employee cash advances are separate from accredited seller commission advances." />
    {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
    {advancesQuery.isLoading ? <StatusAlert type="loading" message="Loading employee cash advances..." /> : null}
    {advancesQuery.isError ? <StatusAlert type="error" message={advancesQuery.error?.message || 'Failed to load employee cash advances.'} /> : null}
    {employeesQuery.isError ? <StatusAlert type="warning" message={employeesQuery.error?.message || 'Failed to load employee options.'} /> : null}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Pending" value={summary.pending || 0} helper="Waiting for approval" icon={FiUsers} />
      <StatCard label="Active" value={summary.active || 0} helper="Open salary advances" icon={FiDollarSign} />
      <StatCard label="Outstanding" value={money(summary.outstandingBalance)} helper="Remaining to deduct" icon={FiDollarSign} />
      <StatCard label="Total Deducted" value={money(summary.totalDeducted)} helper="All recorded deductions" icon={FiCheckCircle} />
      <StatCard label="Paid" value={summary.paid || 0} helper="Completed advances" icon={FiCheckCircle} />
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
      <label className="relative"><FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search employee, code, or reference number..." className="h-11 w-full rounded-xl border border-slate-300 pl-11 pr-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
      <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"><option value="all">All Status</option><option value="pending">Pending</option><option value="active">Active</option><option value="paid">Paid</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select>
      <button type="button" onClick={() => { setSearch(''); setStatus('all'); setPage(1) }} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700 hover:bg-slate-50">Reset</button>
    </div></section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr>{['Reference', 'Employee', 'Request Date', 'Amount', 'Remaining', 'Deducted', 'Status', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
      {!advancesQuery.isLoading && rows.length === 0 ? <tr><td colSpan={8} className="px-6 py-14 text-center font-semibold text-slate-500">No employee cash advances match the selected filters.</td></tr> : null}
      {rows.map((advance) => <tr key={advance.employee_cash_advance_id} className="hover:bg-slate-50"><td className="px-4 py-4 font-black text-blue-700">{advance.reference_number}</td><td className="px-4 py-4"><p className="font-black">{advance.full_name}</p><p className="text-xs text-slate-500">{advance.employee_code} · {advance.department || '-'}</p></td><td className="px-4 py-4 text-slate-600">{advance.request_date}</td><td className="px-4 py-4 font-black">{money(advance.amount)}</td><td className="px-4 py-4 font-black text-amber-700">{money(advance.remaining_balance)}</td><td className="px-4 py-4 font-black text-emerald-700">{money(advance.total_deducted)}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black capitalize ${statusTone[advance.cash_advance_status] || statusTone.pending}`}>{advance.cash_advance_status}</span></td><td className="px-4 py-4"><div className="flex gap-2"><button type="button" onClick={() => setDetailsId(advance.employee_cash_advance_id)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><FiEye />View</button>{canManage && advance.cash_advance_status === 'pending' ? <button type="button" onClick={() => openEdit(advance)} className="h-9 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100">Edit</button> : null}</div></td></tr>)}
    </tbody></table></div><div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} advances</p><div className="flex gap-2"><select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }} className="h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><button disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black disabled:opacity-50">Prev</button><button disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black disabled:opacity-50">Next</button></div></div></section>

    {showModal && canManage ? <CashAdvanceModal advance={selectedAdvance} employees={employees} onClose={() => setShowModal(false)} onSaved={(message) => setAlert({ type: 'success', message })} /> : null}
    {detailsId ? <CashAdvanceDetailsModal advanceId={detailsId} canManage={canManage} onClose={() => setDetailsId(null)} onUpdated={(message) => setAlert({ type: 'success', message })} /> : null}
  </main>
}

export default EmployeeCashAdvances

