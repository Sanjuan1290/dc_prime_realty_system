import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCalendar, FiDollarSign, FiUsers, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'

const GeneratePayrollModal = ({ month, periodType, periodLabel, onClose, onGenerated }) => {
  const queryClient = useQueryClient()
  const [employeeId, setEmployeeId] = useState('all')
  const [errorMessage, setErrorMessage] = useState('')

  const employeesQuery = useQuery({
    queryKey: ['employee-payroll-eligible-employees'],
    queryFn: () => useFetch('/employee-payroll/eligible-employees'),
  })
  const employees = employeesQuery.data?.data || []

  const mutation = useMutation({
    mutationFn: () => useFetchPost('/employee-payroll/drafts/generate', {
      month,
      period_type: periodType,
      ...(employeeId !== 'all' ? { employee_id: Number(employeeId) } : {}),
    }, { confirmationHandled: 'compact' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employee-salary'] })
      onGenerated?.(result)
      onClose()
    },
    onError: (error) => setErrorMessage(error?.message || 'Unable to generate Draft payroll.'),
  })

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><FiDollarSign /><span className="text-xs font-black uppercase tracking-[0.16em]">Draft Payroll</span></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Generate Employee Salary</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Create or refresh Draft payroll from effective compensation and Attendance results.</p>
          </div>
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><FiX /></button>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          {errorMessage ? <StatusAlert type="error" message={errorMessage} onClose={() => setErrorMessage('')} /> : null}
          {employeesQuery.isError ? <StatusAlert type="error" message={employeesQuery.error?.message || 'Unable to load active employees.'} /> : null}

          <section className="grid gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:grid-cols-2">
            <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-700"><FiCalendar />Payroll Period</p><p className="mt-2 font-black text-slate-950">{periodLabel || 'Selected payroll period'}</p></div>
            <div><p className="text-xs font-black uppercase tracking-wide text-blue-700">Payroll State</p><p className="mt-2 font-black text-slate-950">Draft</p></div>
          </section>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800"><FiUsers />Employees</span>
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} disabled={employeesQuery.isLoading || mutation.isPending} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">
              <option value="all">All Active Employees</option>
              {employees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.employee_code} · {employee.full_name} · {employee.department}</option>)}
            </select>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Employees without valid effective compensation for this period are skipped when generating for all employees. Generating one employee returns the validation error directly.</p>
          </label>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            This creates <strong>Draft</strong> payroll only. Attendance and effective compensation can still change the values until the payroll is finalized in Batch 4.
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || employeesQuery.isLoading || employeesQuery.isError} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending ? 'Generating...' : 'Generate Draft Payroll'}</button>
        </footer>
      </div>
    </div>
  )
}

export default GeneratePayrollModal
