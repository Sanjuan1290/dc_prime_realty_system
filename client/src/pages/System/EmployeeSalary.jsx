import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiActivity, FiClock, FiDollarSign, FiDownload, FiFileText, FiLock, FiPlus, FiRefreshCw, FiSearch, FiSettings } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import GeneratePayrollModal from '../../components/System/employeeSalaryComponents/GeneratePayrollModal'
import SalaryDetailModal from '../../components/System/employeeSalaryComponents/SalaryDetailModal'
import FundReleaseReceiptModal from '../../components/System/employeeSalaryComponents/FundReleaseReceiptModal'
import SalaryHistoryModal from '../../components/System/employeeSalaryComponents/SalaryHistoryModal'
import PayrollSettingsModal from '../../components/System/employeeSalaryComponents/PayrollSettingsModal'
import PayrollSummaryExportModal from '../../components/System/employeeSalaryComponents/PayrollSummaryExportModal'
import {
  getManilaMonth,
  money,
  payrollAdditionTotal,
  payrollAllowanceTotal,
  payrollStatusLabel,
  payrollStatusTone,
} from '../../components/System/employeeSalaryComponents/payrollFormatters'
import useCurrentUser from '../../utils/useCurrentUser'
import { useFetch, useFetchPost } from '../../utils/useFetch'
import { PERMISSIONS, hasPermission } from '../../config/permissions'

const EmployeeSalary = () => {
  const { data: currentUserData } = useCurrentUser()
  const queryClient = useQueryClient()
  const canGenerate = hasPermission(currentUserData?.user, PERMISSIONS.PAYROLL_GENERATE)
  const canRecalculate = hasPermission(currentUserData?.user, PERMISSIONS.PAYROLL_RECALCULATE_DRAFT)
  const canFinalize = hasPermission(currentUserData?.user, PERMISSIONS.PAYROLL_FINALIZE)
  const canCorrect = hasPermission(currentUserData?.user, PERMISSIONS.PAYROLL_CORRECT_FINALIZED)
  const canRelease = hasPermission(currentUserData?.user, PERMISSIONS.PAYROLL_RELEASE)
  const canPrintReceipt = hasPermission(currentUserData?.user, PERMISSIONS.PAYROLL_RECEIPT_PRINT)
  const canExportReceipt = hasPermission(currentUserData?.user, PERMISSIONS.PAYROLL_RECEIPT_EXPORT)
  const canViewPayrollHistory = hasPermission(currentUserData?.user, PERMISSIONS.PAYROLL_HISTORY_VIEW)
  const canManagePayrollSettings = hasPermission(currentUserData?.user, PERMISSIONS.PAYROLL_SETTINGS_MANAGE)
  const canExportPayrollSummary = hasPermission(currentUserData?.user, PERMISSIONS.PAYROLL_SUMMARY_EXPORT)

  const [month, setMonth] = useState(getManilaMonth())
  const [periodType, setPeriodType] = useState('first_half')
  const [department, setDepartment] = useState('all')
  const [payrollStatus, setPayrollStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [showGenerate, setShowGenerate] = useState(false)
  const [showPayrollSettings, setShowPayrollSettings] = useState(false)
  const [showPayrollSummaryExport, setShowPayrollSummaryExport] = useState(false)
  const [selectedPayrollId, setSelectedPayrollId] = useState(null)
  const [selectedPayrollTab, setSelectedPayrollTab] = useState('salary')
  const [selectedReceiptPayrollId, setSelectedReceiptPayrollId] = useState(null)
  const [historyEmployee, setHistoryEmployee] = useState(null)
  const [alert, setAlert] = useState(null)

  const periodQueryString = useMemo(() => new URLSearchParams({ month, period_type: periodType }).toString(), [month, periodType])
  const registerQueryString = useMemo(() => new URLSearchParams({
    month,
    period_type: periodType,
    ...(department !== 'all' ? { department } : {}),
    ...(payrollStatus !== 'all' ? { payroll_status: payrollStatus } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  }).toString(), [month, periodType, department, payrollStatus, search])

  const periodQuery = useQuery({
    queryKey: ['employee-salary', 'period', periodQueryString],
    queryFn: () => useFetch(`/employee-payroll/period-preview?${periodQueryString}`),
  })
  const registerQuery = useQuery({
    queryKey: ['employee-salary', 'register', registerQueryString],
    queryFn: () => useFetch(`/employee-payroll/drafts?${registerQueryString}`),
    keepPreviousData: true,
  })
  const departmentsQuery = useQuery({
    queryKey: ['employee-salary', 'departments', periodQueryString],
    queryFn: () => useFetch(`/employee-payroll/drafts?${periodQueryString}`),
    keepPreviousData: true,
  })

  const rows = registerQuery.data?.data || []
  const period = periodQuery.data?.data || null
  const departmentRows = departmentsQuery.data?.data || []
  const departments = useMemo(() => Array.from(new Set(departmentRows.map((row) => row.department_snapshot).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [departmentRows])
  const summary = useMemo(() => rows.reduce((result, row) => ({
    employeeCount: result.employeeCount + 1,
    totalBasic: result.totalBasic + Number(row.half_month_basic || 0),
    totalDeduction: result.totalDeduction + Number(row.attendance_deduction || 0) + Number(row.manual_deductions_total || 0),
    totalAllowances: result.totalAllowances + payrollAllowanceTotal(row),
    totalNet: result.totalNet + Number(row.net_fund_release || 0),
  }), { employeeCount: 0, totalBasic: 0, totalDeduction: 0, totalAllowances: 0, totalNet: 0 }), [rows])

  const recalcMutation = useMutation({
    mutationFn: (payrollId) => useFetchPost(`/employee-payroll/drafts/${payrollId}/recalculate`, {}, { confirmationHandled: 'compact' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result.message || 'Draft payroll recalculated.' })
      queryClient.invalidateQueries({ queryKey: ['employee-salary'] })
    },
    onError: (error) => setAlert({ type: 'error', message: error?.message || 'Unable to recalculate Draft payroll.' }),
  })

  const openPayroll = (payrollId, tab = 'salary') => {
    setSelectedPayrollId(payrollId)
    setSelectedPayrollTab(tab)
  }

  const handleGenerated = (result) => {
    const generated = result?.data?.generated?.length || 0
    const skipped = result?.data?.skipped?.length || 0
    setAlert({
      type: skipped ? 'warning' : 'success',
      message: skipped
        ? `Draft payroll generated for ${generated} employee(s). ${skipped} employee(s) were skipped because their payroll could not be calculated.`
        : result?.message || `Draft payroll generated for ${generated} employee(s).`,
    })
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title="Employee Salary" description="Review half-month payroll generated from effective compensation and Attendance. Draft values remain recalculable until Finalization." icon={FiDollarSign} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { periodQuery.refetch(); registerQuery.refetch() }} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"><FiRefreshCw className={registerQuery.isFetching || periodQuery.isFetching ? 'animate-spin' : ''} />Refresh</button>
          {canExportPayrollSummary ? <button type="button" onClick={() => setShowPayrollSummaryExport(true)} disabled={!period} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"><FiDownload />Export Summary</button> : null}
          {canManagePayrollSettings ? <button type="button" onClick={() => setShowPayrollSettings(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"><FiSettings />Payroll Settings</button> : null}
          {canGenerate ? <button type="button" onClick={() => setShowGenerate(true)} disabled={!period} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"><FiPlus />Generate Draft Payroll</button> : null}
        </div>
      </div>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
      {periodQuery.isError ? <StatusAlert type="error" message={periodQuery.error?.message || 'Unable to resolve the payroll period.'} /> : null}
      {registerQuery.isError ? <StatusAlert type="error" message={registerQuery.error?.message || 'Unable to load employee salary.'} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Employees', summary.employeeCount],
          ['Half-Month Basic', money(summary.totalBasic)],
          ['Deductions', money(summary.totalDeduction)],
          ['Allowances', money(summary.totalAllowances)],
          ['Total Fund Release', money(summary.totalNet)],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>)}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Month</span><input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setDepartment('all') }} className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold" /></label>
          <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Payroll Period</span><select value={periodType} onChange={(event) => { setPeriodType(event.target.value); setDepartment('all') }} className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value="first_half">1–15</option><option value="second_half">16–End of Month</option></select></label>
          <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Department</span><select value={department} onChange={(event) => setDepartment(event.target.value)} className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value="all">All Departments</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Payroll Status</span><select value={payrollStatus} onChange={(event) => setPayrollStatus(event.target.value)} className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold"><option value="all">All Statuses</option><option value="draft">Draft</option><option value="finalized">Finalized</option><option value="corrected">Corrected</option><option value="released">Released</option><option value="cancelled">Cancelled</option></select></label>
          <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">Search Employee</span><span className="relative block"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, code, position..." className="h-10 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm font-semibold" /></span></label>
        </div>

        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div><span className="font-black text-slate-900">{period?.periodLabel || 'Resolving payroll period...'}</span><span className="ml-2 font-semibold text-slate-500">{rows.length} payroll record(s)</span></div>
          <p className="text-xs font-semibold text-slate-500">Draft receipt = Preview only. Official Print / Export becomes available after Finalization.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1320px] w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50"><tr>{['Employee', 'Position', 'Basic', 'Deduction', 'OT / Additions', 'Allowances', 'Net', 'Status', 'Actions'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {registerQuery.isLoading ? <tr><td colSpan={9} className="px-5 py-16 text-center font-semibold text-slate-500">Loading employee salary...</td></tr> : null}
              {!registerQuery.isLoading && !rows.length ? <tr><td colSpan={9} className="px-5 py-16 text-center"><p className="font-black text-slate-800">No payroll generated for this period</p><p className="mt-1 text-sm font-semibold text-slate-500">Generate Draft Payroll to calculate employee salary from Attendance and effective compensation.</p></td></tr> : null}
              {rows.map((row) => <tr key={row.employee_payroll_id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-4"><p className="font-black text-slate-950">{row.employee_name_snapshot}</p><p className="mt-1 font-mono text-xs font-bold text-blue-700">{row.employee_code || `Employee #${row.employee_id}`}</p><p className="mt-1 text-xs font-semibold text-slate-500">{row.department_snapshot || '—'}</p></td>
                <td className="px-4 py-4 font-semibold text-slate-700">{row.position_snapshot || '—'}</td>
                <td className="px-4 py-4 font-black text-slate-950">{money(row.half_month_basic)}</td>
                <td className="px-4 py-4 font-semibold text-rose-700">{money(Number(row.attendance_deduction || 0) + Number(row.manual_deductions_total || 0))}</td>
                <td className="px-4 py-4 font-semibold text-slate-700">{money(payrollAdditionTotal(row))}</td>
                <td className="px-4 py-4 font-semibold text-slate-700">{money(payrollAllowanceTotal(row))}</td>
                <td className="px-4 py-4 text-base font-black text-emerald-700">{money(row.net_fund_release)}</td>
                <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${payrollStatusTone(row.payroll_status)}`}>{payrollStatusLabel(row.payroll_status)}</span>{row.calculation_warnings?.length ? <p className="mt-2 max-w-[220px] text-xs font-semibold leading-4 text-amber-700">{row.calculation_warnings.length} calculation warning(s)</p> : null}</td>
                <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openPayroll(row.employee_payroll_id, 'salary')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"><FiFileText />View Salary</button><button type="button" onClick={() => openPayroll(row.employee_payroll_id, 'attendance')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><FiActivity />Attendance</button>{canRecalculate && row.payroll_status === 'draft' ? <button type="button" onClick={() => recalcMutation.mutate(row.employee_payroll_id)} disabled={recalcMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-black text-violet-700 hover:bg-violet-100 disabled:opacity-50"><FiRefreshCw className={recalcMutation.isPending ? 'animate-spin' : ''} />Recalculate</button> : null}{canFinalize && row.payroll_status === 'draft' ? <button type="button" onClick={() => openPayroll(row.employee_payroll_id, 'salary')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100"><FiLock />Final Review</button> : null}<button type="button" onClick={() => setSelectedReceiptPayrollId(row.employee_payroll_id)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">Preview Receipt</button>{canViewPayrollHistory ? <button type="button" onClick={() => setHistoryEmployee({ employee_id: row.employee_id, employee_code: row.employee_code, full_name: row.employee_name_snapshot })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><FiClock />History</button> : null}</div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>

      {showPayrollSummaryExport ? <PayrollSummaryExportModal month={month} periodType={periodType} periodLabel={period?.periodLabel} onClose={() => setShowPayrollSummaryExport(false)} /> : null}
      {showPayrollSettings ? <PayrollSettingsModal onClose={() => setShowPayrollSettings(false)} onSaved={(result) => { setAlert({ type: 'success', message: result?.message || 'Payroll Settings updated.' }); registerQuery.refetch() }} /> : null}
      {showGenerate ? <GeneratePayrollModal month={month} periodType={periodType} periodLabel={period?.periodLabel} onClose={() => setShowGenerate(false)} onGenerated={handleGenerated} /> : null}
      {selectedPayrollId ? <SalaryDetailModal payrollId={selectedPayrollId} initialTab={selectedPayrollTab} canRecalculate={canRecalculate} canFinalize={canFinalize} canCorrect={canCorrect} canRelease={canRelease} canPrintReceipt={canPrintReceipt} canExportReceipt={canExportReceipt} onClose={() => setSelectedPayrollId(null)} onUpdated={() => registerQuery.refetch()} /> : null}
      {selectedReceiptPayrollId ? <FundReleaseReceiptModal payrollId={selectedReceiptPayrollId} canPrint={canPrintReceipt} canExport={canExportReceipt} onClose={() => setSelectedReceiptPayrollId(null)} /> : null}
      {historyEmployee ? <SalaryHistoryModal employee={historyEmployee} canCorrect={canCorrect} canRelease={canRelease} canPrintReceipt={canPrintReceipt} canExportReceipt={canExportReceipt} onClose={() => setHistoryEmployee(null)} /> : null}
    </main>
  )
}

export default EmployeeSalary

