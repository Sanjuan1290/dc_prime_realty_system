import { useQuery } from '@tanstack/react-query'
import { FiClock, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch } from '../../../utils/useFetch'

const CHANGE_LABELS = {
  hired: 'Hired', promotion: 'Promotion', salary_increase: 'Salary Increase', position_change: 'Position Change',
  department_transfer: 'Department Transfer', employment_status_change: 'Employment Status Change',
  allowance_adjustment: 'Allowance Adjustment', demotion: 'Demotion', other: 'Other Employment Change',
}

const EMPLOYMENT_LABELS = {
  regular: 'Full Time', probationary: 'Probationary', contractual: 'Contractual', part_time: 'Part Time', intern: 'Intern',
}

const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatDate = (value) => value ? new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00+08:00`)) : 'Present'
const formatTimestamp = (value) => {
  if (!value) return '—'
  const text = String(value).trim().replace(' ', 'T')
  const instant = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`
  return new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }).format(new Date(instant))
}

const EmploymentHistoryModal = ({ employee, onClose }) => {
  const query = useQuery({
    queryKey: ['employee-employment-history', employee?.employee_id],
    queryFn: () => useFetch(`/employees/${employee.employee_id}/employment-history`),
    enabled: Boolean(employee?.employee_id),
  })
  const history = query.data?.history || []
  const current = query.data?.current || null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><FiClock /><span className="text-xs font-black uppercase tracking-[0.16em]">Immutable Employment Timeline</span></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Employment & Compensation History</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{employee?.full_name} · {employee?.employee_code}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          {query.isLoading ? <StatusAlert type="loading" message="Loading employment history..." /> : null}
          {query.isError ? <StatusAlert type="error" message={query.error?.message || 'Failed to load employment history.'} /> : null}

          {!query.isLoading && current ? (
            <section className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Current Employment & Compensation</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs font-bold text-slate-500">Position</p><p className="mt-1 font-black text-slate-900">{current.position}</p></div>
                <div><p className="text-xs font-bold text-slate-500">Department</p><p className="mt-1 font-black text-slate-900">{current.department}</p></div>
                <div><p className="text-xs font-bold text-slate-500">Employment Type</p><p className="mt-1 font-black text-slate-900">{EMPLOYMENT_LABELS[current.employment_type] || current.employment_type}</p></div>
                <div><p className="text-xs font-bold text-slate-500">Monthly Basic</p><p className="mt-1 font-black text-slate-900">{money(current.monthly_basic_salary)}</p></div>
              </div>
            </section>
          ) : null}

          {!query.isLoading && history.length ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1320px] w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50"><tr>{['Effective Period', 'Change', 'Position', 'Employment Type', 'Department', 'Monthly Basic', 'Rice', 'Transportation', 'Attendance Bonus', 'Reason / Notes', 'Recorded By', 'Recorded At'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((item) => <tr key={item.employee_employment_history_id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-4 font-black text-slate-900">{formatDate(item.effective_from)} – {item.effective_to ? formatDate(item.effective_to) : 'Present'}</td>
                    <td className="px-4 py-4"><span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-200">{CHANGE_LABELS[item.change_type] || item.change_type}</span></td>
                    <td className="px-4 py-4 font-semibold text-slate-800">{item.position}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{EMPLOYMENT_LABELS[item.employment_type] || item.employment_type}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{item.department}</td>
                    <td className="px-4 py-4 font-black text-slate-900">{money(item.monthly_basic_salary)}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{money(item.rice_allowance)}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{money(item.transportation_allowance)}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{money(item.attendance_bonus)}</td>
                    <td className="max-w-[280px] px-4 py-4 text-sm font-semibold leading-5 text-slate-600">{item.change_reason || '—'}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{item.created_by_name || 'System'}</td>
                    <td className="px-4 py-4 text-xs font-semibold text-slate-500">{formatTimestamp(item.created_at)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          ) : null}

          {!query.isLoading && !query.isError && !history.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center"><p className="font-black text-slate-800">No employment history found</p><p className="mt-1 text-sm font-semibold text-slate-500">The Batch-1 migration backfills the current employee profile as the initial Hired record.</p></div> : null}

          <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">Historical records are read-only in the normal workflow. A protected correction flow with reason, before/after review, authorization, and Audit Log will handle genuine historical corrections without silently rewriting payroll history.</p>
        </div>

        <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6"><button type="button" onClick={onClose} className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-black text-white">Close</button></footer>
      </div>
    </div>
  )
}

export default EmploymentHistoryModal
