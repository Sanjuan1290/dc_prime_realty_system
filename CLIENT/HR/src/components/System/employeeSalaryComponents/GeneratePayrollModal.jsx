import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiAlertTriangle, FiCalendar, FiDollarSign, FiUsers, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'

// Present payroll checks as actions staff can take, not internal validation codes.
const explainIssue = (issue) => {
  switch (issue?.code) {
    case 'NEW_HIRE_PRORATION_NOT_APPROVED':
      return 'First pay needs approval because this employee started during the pay period. Ask an authorized manager to enable partial first pay in Payroll Settings.'
    case 'NEW_HIRE_COMPENSATION_DATE_MISMATCH':
      return 'The salary start date does not match the hire date. Check the employee’s salary history.'
    case 'PAYROLL_COMPENSATION_NOT_FOUND':
      return 'Salary details are missing for this pay period. Update the employee’s salary history.'
    case 'PARTIAL_PERIOD_COMPENSATION_BLOCKED':
      return 'Salary details do not cover this pay period. Check the salary start and end dates.'
    case 'MID_PERIOD_COMPENSATION_CHANGE_BLOCKED':
      return 'A salary change starts during this pay period. Salary changes must begin on the 1st or 16th.'
    case 'INVALID_REGULAR_WORKING_MINUTES':
      return 'Working hours are missing. Update Attendance Settings.'
    case 'FUTURE_PAYROLL_PERIOD':
      return 'Payroll cannot be generated for this future pay period yet.'
    default:
      return issue?.message || 'Check this employee’s payroll details.'
  }
}

const explainWarning = (warning) => {
  const text = String(warning || '')
  const extraPay = text.match(/^Payroll Settings not configured for recorded premium hours: (.+)\. Draft premium pay may be ₱0\.00\.$/)
  if (extraPay) {
    const rates = extraPay[1].replace(/Regular OT/g, 'Regular Overtime').replace(/Rest Day OT/g, 'Rest Day Overtime').replace(/Night Differential/g, 'Night Shift Extra Pay')
    return `Missing pay rate: ${rates}. Add the approved rate in Payroll Settings or these extra hours will be ₱0.00 in the draft.`
  }
  if (text.startsWith('No rest-day assignment was found')) return 'Rest days are not set. Check the employee’s work schedule.'
  if (text.startsWith('No Time In/Out entries were found')) return 'No attendance was recorded. Missing workdays may be counted as absences.'
  if (text.includes('have Time In but no Time Out')) return 'Some attendance records have no Time Out. Check Attendance before creating payroll.'
  if (text.startsWith('Approved new-hire workday proration applies')) return 'First pay will include scheduled workdays on or after the hire date.'
  if (text.startsWith('Monthly basic salary is ₱0.00')) return 'Monthly basic salary is ₱0.00. Check the employee’s salary details.'
  return text
}

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
  const needsReview = included.filter((employee) => employee.payroll_readiness?.issues?.length || employee.payroll_readiness?.warnings?.length)

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
        return // Show who needs fixes; do not present skipped employees as paid.
      }
      onClose()
    },
    onError: (error) => setErrorMessage(error?.message || 'Unable to create payroll draft.'),
  })

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2"><FiDollarSign className="text-blue-600" /><h2 className="text-xl font-black text-slate-950">Create Payroll Draft</h2></div>
          <button type="button" onClick={onClose} disabled={mutation.isPending} aria-label="Close Create Payroll Draft" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><FiX /></button>
        </header>

        <div className="space-y-4 overflow-y-auto p-5 sm:p-6">
          {errorMessage ? <StatusAlert type="error" message={errorMessage} onClose={() => setErrorMessage('')} /> : null}
          {employeesQuery.isError ? <StatusAlert type="error" message={employeesQuery.error?.message || 'Unable to check employee payroll details.'} /> : null}
          {lastResult ? (
            <section role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-950">{lastResult.generated?.length || 0} drafts created · {lastResult.skipped?.length || 0} employees need changes</p>
              <div className="mt-3 space-y-2">
                {lastResult.skipped?.map((item) => (
                  <div key={item.employee_id} className="rounded-xl border border-amber-200 bg-white p-3 text-sm">
                    <p className="font-bold text-slate-900">{item.employee_name} · {item.employee_code}</p>
                    <p className="mt-1 text-amber-900">{explainIssue(item)}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:grid-cols-2">
            <div><p className="flex items-center gap-2 text-xs font-bold text-blue-800"><FiCalendar />Pay Period</p><p className="mt-1 font-bold text-slate-950">{periodLabel || 'Selected period'}</p></div>
            <div><p className="text-xs font-bold text-blue-800">Scheduled Payday</p><p className="mt-1 font-bold text-slate-950">{scheduledReleaseDate || '—'}</p></div>
          </section>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800"><FiUsers />Choose Employees</span>
            <select value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setLastResult(null) }} disabled={employeesQuery.isLoading || mutation.isPending} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">
              <option value="all">All Active Employees</option>
              {employees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.employee_code} · {employee.full_name}{employee.payroll_readiness && !employee.payroll_readiness.can_generate ? ' · Needs changes' : ''}</option>)}
            </select>
          </label>

          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-black text-slate-900">Payroll Check</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${notReady.length ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                {employeesQuery.isLoading ? 'Checking...' : `${ready} ready · ${notReady.length} need changes`}
              </span>
            </div>
            {!employeesQuery.isLoading && !employeesQuery.isError && !included.length ? <p className="mt-3 text-sm text-slate-600">No employees found for this pay period.</p> : null}
            {!employeesQuery.isLoading && included.length > 0 && !needsReview.length ? <p className="mt-2 text-sm font-medium text-emerald-700">No payroll issues found.</p> : null}

            {needsReview.length ? <div className="mt-3 space-y-3">{needsReview.map((employee) => {
              const issues = employee.payroll_readiness?.issues || []
              const warnings = employee.payroll_readiness?.warnings || []
              return (
                <div key={employee.employee_id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-950"><FiAlertTriangle className="shrink-0 text-amber-600" />{employee.full_name} · {employee.employee_code}</p>
                  {issues.length ? <div className="mt-2 space-y-2">{issues.map((issue, index) => <p key={`${issue.code}-${index}`} className="text-sm font-medium text-rose-900"><strong>Fix:</strong> {explainIssue(issue)}</p>)}</div> : null}
                  {warnings.length ? <div className="mt-2 space-y-2">{warnings.map((warning, index) => <p key={index} className="text-sm text-amber-900"><strong>Check:</strong> {explainWarning(warning)}</p>)}</div> : null}
                </div>
              )
            })}</div> : null}
          </section>

          <p className="text-sm text-slate-600">This creates a draft only. It does not send salary payments.</p>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 disabled:opacity-50">Close</button>
          <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || employeesQuery.isLoading || employeesQuery.isError || ready === 0} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending ? 'Creating...' : notReady.length ? 'Create Drafts for Ready Employees' : 'Create Payroll Draft'}</button>
        </footer>
      </div>
    </div>
  )
}

export default GeneratePayrollModal


