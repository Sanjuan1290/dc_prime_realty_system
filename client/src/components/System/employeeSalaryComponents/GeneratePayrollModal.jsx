import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiAlertTriangle, FiCalendar, FiCheckCircle, FiDollarSign, FiUsers, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'

const payrollFieldGuide = [
  ['Employees', 'Active status, employee code, full name, hire date, position, department and employment type.'],
  ['Employment & Compensation History', 'Effective monthly salary and allowances. New hires starting inside a period require an approved first-payroll policy.'],
  ['Attendance Settings', 'Shift, break, regular working minutes (greater than zero), and attendance rules.'],
  ['Attendance', 'Correct daily Time In/Out, leaves, holidays and rest-day assignments. Missing attendance may count as absence.'],
  ['Payroll Settings', 'Company-approved overtime, holiday and night differential rates for premium hours, when applicable.'],
]

const GeneratePayrollModal = ({ month, periodType, periodLabel, scheduledReleaseDate, onClose, onGenerated }) => {
  const queryClient = useQueryClient()
  const [employeeId, setEmployeeId] = useState('all')
  const [errorMessage, setErrorMessage] = useState('')
  const [lastResult, setLastResult] = useState(null)

  const employeesQuery = useQuery({
    queryKey: ['employee-payroll-eligible-employees', month, periodType],
    queryFn: () => useFetch(`/employee-payroll/eligible-employees?${new URLSearchParams({ month, period_type: periodType })}`),
  })
  const employees = employeesQuery.data?.data || []
  const selected = useMemo(() => employeeId === 'all' ? null : employees.find((item) => Number(item.employee_id) === Number(employeeId)), [employees, employeeId])
  const included = employeeId === 'all' ? employees : selected ? [selected] : []
  const notReady = included.filter((item) => item.payroll_readiness?.can_generate === false)
  const ready = included.length - notReady.length

  const mutation = useMutation({
    mutationFn: () => useFetchPost('/employee-payroll/drafts/generate', {
      month,
      period_type: periodType,
      ...(employeeId !== 'all' ? { employee_id: Number(employeeId) } : {}),
    }, { confirmationHandled: 'compact' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employee-salary'] })
      queryClient.invalidateQueries({ queryKey: ['employee-payroll-eligible-employees'] })
      onGenerated?.(result)
      if (result?.data?.skipped?.length) {
        setLastResult(result.data)
        return // Show the exact skipped employee and reason instead of closing.
      }
      onClose()
    },
    onError: (error) => setErrorMessage(error?.message || 'Unable to generate Draft payroll.'),
  })

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><FiDollarSign /><span className="text-xs font-black uppercase tracking-[0.16em]">Draft Payroll</span></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Generate Employee Salary</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Connected to Employees, effective compensation history and Attendance for the selected period.</p>
          </div>
          <button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Close Generate Payroll" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><FiX /></button>
        </header>

        <div className="space-y-4 overflow-y-auto p-5 sm:p-6">
          {errorMessage ? <StatusAlert type="error" message={errorMessage} onClose={() => setErrorMessage('')} /> : null}
          {employeesQuery.isError ? <StatusAlert type="error" message={employeesQuery.error?.message || 'Unable to verify employee payroll readiness.'} /> : null}
          {lastResult ? (
            <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-950">{lastResult.generated?.length || 0} Draft payroll(s) generated · {lastResult.skipped?.length || 0} skipped</p>
              <div className="mt-3 space-y-2">
                {lastResult.skipped?.map((item) => (
                  <div key={item.employee_id} className="rounded-xl border border-amber-200 bg-white p-3 text-sm">
                    <p className="font-black text-slate-900">{item.employee_name} · {item.employee_code}</p>
                    <p className="mt-1 text-rose-800">{item.message}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{item.code}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs font-semibold text-amber-900">Correct the source information in Employees, Attendance or Payroll Settings, then generate again. No failed employee was marked as paid.</p>
            </section>
          ) : null}

          <section className="grid gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:grid-cols-2">
            <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-700"><FiCalendar />Payroll Period</p><p className="mt-2 font-black text-slate-950">{periodLabel || 'Selected payroll period'}</p></div>
            <div><p className="text-xs font-black uppercase tracking-wide text-blue-700">Scheduled Payday</p><p className="mt-2 font-black text-slate-950">{scheduledReleaseDate || '—'}</p><p className="text-xs font-semibold text-blue-700">Draft — not released</p></div>
          </section>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800"><FiUsers />Employees</span>
            <select value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setLastResult(null) }} disabled={employeesQuery.isLoading || mutation.isPending} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">
              <option value="all">All Active Employees</option>
              {employees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.employee_code} · {employee.full_name} · {employee.department}{employee.payroll_readiness && !employee.payroll_readiness.can_generate ? ' · Needs attention' : ''}</option>)}
            </select>
          </label>

          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-black text-slate-900">Payroll readiness — Employees + Attendance</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${notReady.length ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{employeesQuery.isLoading ? 'Checking…' : `${ready} ready · ${notReady.length} needs attention`}</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">Read-only validation for this payroll period; no employee or attendance records are modified.</p>
            {notReady.length ? <div className="mt-3 space-y-2">{notReady.map((employee) => (
              <div key={employee.employee_id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-sm font-black text-slate-900"><FiAlertTriangle className="text-amber-600" />{employee.full_name} · {employee.employee_code}</p>
                <ul className="mt-2 list-disc pl-5 text-xs font-semibold leading-5 text-amber-950">{employee.payroll_readiness.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>
              </div>
            ))}</div> : null}
            {selected?.payroll_readiness ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selected.payroll_readiness.checks.map((check) => (
                  <div key={check.field} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="flex items-center gap-2 text-xs font-black text-slate-800">{check.ok ? <FiCheckCircle className="text-emerald-600" /> : <FiAlertTriangle className="text-amber-600" />}{check.label}{check.required ? ' *' : ''}</p>
                    <p className="mt-1 text-xs text-slate-500">{check.source}</p>
                  </div>
                ))}
                {selected.payroll_readiness.warnings?.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900 sm:col-span-2"><p className="font-black">Verify before generating</p><ul className="mt-1 list-disc pl-5">{selected.payroll_readiness.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></div> : null}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 sm:col-span-2">
                  Attendance: {selected.payroll_readiness.attendance?.recorded_days || 0} day(s) recorded · {selected.payroll_readiness.attendance?.incomplete_days || 0} incomplete Time Out · Rest days: {selected.payroll_readiness.attendance?.rest_days?.join(', ') || 'Not configured'}
                </div>
              </div>
            ) : null}
          </section>

          <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4" open={notReady.length > 0}>
            <summary className="cursor-pointer text-sm font-black text-slate-900">Fields and settings required for payroll generation</summary>
            <div className="mt-3 space-y-2">{payrollFieldGuide.map(([source, description]) => (
              <div key={source} className="rounded-xl bg-white px-3 py-2 text-xs leading-5"><p className="font-black text-blue-800">{source}</p><p className="font-medium text-slate-700">{description}</p></div>
            ))}</div>
            <p className="mt-3 text-xs font-semibold text-amber-800">Compensation must cover the full half-month. Mid-period changes or new hires starting partway through a period cannot be prorated until an approved proration rule exists.</p>
          </details>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            This creates <strong>Draft</strong> payroll only. Attendance and effective compensation can change the values until finalization. Missing daily attendance can be treated as absence; verify Attendance before generating.
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-50">Close</button>
          <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || employeesQuery.isLoading || employeesQuery.isError || !included.length || Boolean(selected && notReady.length)} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending ? 'Generating...' : notReady.length ? 'Generate Ready Employees' : 'Generate Draft Payroll'}</button>
        </footer>
      </div>
    </div>
  )
}

export default GeneratePayrollModal
