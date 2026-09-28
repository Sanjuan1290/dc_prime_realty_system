import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArrowLeft, FiCheckCircle, FiTrendingUp, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'

const inputClass = 'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const CHANGE_TYPES = [
  ['promotion', 'Promotion'],
  ['salary_increase', 'Salary Increase'],
  ['position_change', 'Position Change'],
  ['department_transfer', 'Department Transfer'],
  ['employment_status_change', 'Employment Status Change'],
  ['allowance_adjustment', 'Allowance Adjustment'],
  ['demotion', 'Demotion'],
  ['other', 'Other Employment Change'],
]

const EMPLOYMENT_TYPES = [
  ['regular', 'Full Time'],
  ['probationary', 'Probationary'],
  ['contractual', 'Contractual'],
  ['part_time', 'Part Time'],
  ['intern', 'Intern'],
]

const getManilaDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const employmentLabel = (value) => EMPLOYMENT_TYPES.find(([key]) => key === value)?.[1] || value || '—'
const changeLabel = (value) => CHANGE_TYPES.find(([key]) => key === value)?.[1] || value || 'Employment Change'

const ComparisonRow = ({ label, before, after }) => {
  const changed = String(before ?? '') !== String(after ?? '')
  return (
    <div className={`grid gap-2 rounded-xl border p-3 sm:grid-cols-[1.2fr_1fr_1fr] ${changed ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-600">{before || '—'}</span>
      <span className={`text-sm font-black ${changed ? 'text-blue-800' : 'text-slate-800'}`}>{after || '—'}</span>
    </div>
  )
}

const EmploymentChangeModal = ({ employee, departmentConfigs = [], departments = [], onClose, onSaved }) => {
  const queryClient = useQueryClient()
  const [step, setStep] = useState('form')
  const [notice, setNotice] = useState(null)
  const [seeded, setSeeded] = useState(false)
  const [form, setForm] = useState({
    change_type: 'promotion',
    position: '',
    department: '',
    employment_type: 'regular',
    monthly_basic_salary: '',
    rice_allowance: '0',
    transportation_allowance: '0',
    attendance_bonus: '0',
    effective_from: getManilaDate(),
    change_reason: '',
  })

  const historyQuery = useQuery({
    queryKey: ['employee-employment-history', employee?.employee_id],
    queryFn: () => useFetch(`/employees/${employee.employee_id}/employment-history`),
    enabled: Boolean(employee?.employee_id),
  })
  const current = historyQuery.data?.current || null

  useEffect(() => {
    if (!current || seeded) return
    setForm((value) => ({
      ...value,
      position: current.position || '',
      department: current.department || '',
      employment_type: current.employment_type || 'regular',
      monthly_basic_salary: String(current.monthly_basic_salary ?? 0),
      rice_allowance: String(current.rice_allowance ?? 0),
      transportation_allowance: String(current.transportation_allowance ?? 0),
      attendance_bonus: String(current.attendance_bonus ?? 0),
    }))
    setSeeded(true)
  }, [current, seeded])

  const departmentOptions = useMemo(() => {
    const configured = (departmentConfigs || []).map((item) => item?.name).filter(Boolean)
    const values = configured.length ? configured : (departments || []).filter(Boolean)
    if (current?.department && !values.includes(current.department)) values.push(current.department)
    return [...new Set(values)]
  }, [departmentConfigs, departments, current?.department])

  const setValue = (field, value) => {
    setNotice(null)
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  const validate = () => {
    if (!form.position.trim() || !form.department || !form.employment_type || !form.effective_from) {
      setNotice({ type: 'warning', message: 'Position, Department, Employment Type, and Effective Date are required.' })
      return false
    }
    if (!form.change_reason.trim()) {
      setNotice({ type: 'warning', message: 'Reason / Notes is required so the employment change has a clear audit trail.' })
      return false
    }
    const amounts = [form.monthly_basic_salary, form.rice_allowance, form.transportation_allowance, form.attendance_bonus]
    if (amounts.some((value) => value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) {
      setNotice({ type: 'warning', message: 'Salary and allowance values must be zero or greater.' })
      return false
    }
    if (current?.effective_from && form.effective_from <= current.effective_from) {
      setNotice({ type: 'warning', message: `Effective Date must be after ${current.effective_from}. Earlier changes require a historical correction, not a new employment change.` })
      return false
    }
    if (form.effective_from > getManilaDate()) {
      setNotice({ type: 'warning', message: 'Effective Date cannot be in the future in Batch 1.' })
      return false
    }
    return true
  }

  const mutation = useMutation({
    mutationFn: () => useFetchPost(`/employees/${employee.employee_id}/employment-changes`, form, { confirmationHandled: 'compact' }),
    onMutate: () => setNotice({ type: 'loading', message: 'Saving employment and compensation change...' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee-employment-history', employee.employee_id] })
      onSaved?.(result?.message || 'Employment change saved successfully.')
      onClose?.()
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to save employment change.' }),
  })

  const goToReview = () => {
    if (!validate()) return
    setNotice(null)
    setStep('review')
  }

  const reviewRows = current ? [
    ['Position', current.position, form.position],
    ['Department', current.department, form.department],
    ['Employment Type', employmentLabel(current.employment_type), employmentLabel(form.employment_type)],
    ['Monthly Basic Salary', money(current.monthly_basic_salary), money(form.monthly_basic_salary)],
    ['Rice Allowance', money(current.rice_allowance), money(form.rice_allowance)],
    ['Transportation Allowance', money(current.transportation_allowance), money(form.transportation_allowance)],
    ['Attendance Bonus', money(current.attendance_bonus), money(form.attendance_bonus)],
  ] : []

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><FiTrendingUp /><span className="text-xs font-black uppercase tracking-[0.16em]">Employment & Compensation History</span></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">{step === 'review' ? 'Final Double-Check' : 'Promote / Update Compensation'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{employee?.full_name} · {employee?.employee_code}</p>
          </div>
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          {historyQuery.isLoading ? <StatusAlert type="loading" message="Loading current employment and compensation record..." /> : null}
          {historyQuery.isError ? <StatusAlert type="error" message={historyQuery.error?.message || 'Failed to load employment history.'} /> : null}
          {notice ? <div className="mb-5"><StatusAlert type={notice.type} message={notice.message} /></div> : null}

          {!historyQuery.isLoading && current && step === 'form' ? (
            <div className="grid gap-5">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Current Record</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-xs font-bold text-slate-500">Position</p><p className="mt-1 text-sm font-black text-slate-900">{current.position}</p></div>
                  <div><p className="text-xs font-bold text-slate-500">Employment Type</p><p className="mt-1 text-sm font-black text-slate-900">{employmentLabel(current.employment_type)}</p></div>
                  <div><p className="text-xs font-bold text-slate-500">Department</p><p className="mt-1 text-sm font-black text-slate-900">{current.department}</p></div>
                  <div><p className="text-xs font-bold text-slate-500">Monthly Basic</p><p className="mt-1 text-sm font-black text-slate-900">{money(current.monthly_basic_salary)}</p></div>
                </div>
              </section>

              <section className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 md:grid-cols-2">
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Change Type *</span><select className={inputClass} value={form.change_type} onChange={(e) => setValue('change_type', e.target.value)}>{CHANGE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Effective Date *</span><input type="date" max={getManilaDate()} className={inputClass} value={form.effective_from} onChange={(e) => setValue('effective_from', e.target.value)} /></label>
                <label className="grid gap-2 md:col-span-2"><span className="text-sm font-black text-slate-700">Position *</span><input className={inputClass} value={form.position} onChange={(e) => setValue('position', e.target.value)} /></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Department *</span><select className={inputClass} value={form.department} onChange={(e) => setValue('department', e.target.value)}>{departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Employment Type *</span><select className={inputClass} value={form.employment_type} onChange={(e) => setValue('employment_type', e.target.value)}>{EMPLOYMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Monthly Basic Salary *</span><input type="number" min="0" step="0.01" className={inputClass} value={form.monthly_basic_salary} onChange={(e) => setValue('monthly_basic_salary', e.target.value)} /></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Rice Allowance</span><input type="number" min="0" step="0.01" className={inputClass} value={form.rice_allowance} onChange={(e) => setValue('rice_allowance', e.target.value)} /></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Transportation Allowance</span><input type="number" min="0" step="0.01" className={inputClass} value={form.transportation_allowance} onChange={(e) => setValue('transportation_allowance', e.target.value)} /></label>
                <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Attendance Bonus</span><input type="number" min="0" step="0.01" className={inputClass} value={form.attendance_bonus} onChange={(e) => setValue('attendance_bonus', e.target.value)} /></label>
                <label className="grid gap-2 md:col-span-2"><span className="text-sm font-black text-slate-700">Reason / Notes *</span><textarea rows={4} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50" value={form.change_reason} onChange={(e) => setValue('change_reason', e.target.value)} placeholder="Explain why this employment or compensation change is being made." /></label>
              </section>
            </div>
          ) : null}

          {!historyQuery.isLoading && current && step === 'review' ? (
            <div className="grid gap-5">
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black text-amber-900">Final Double-Check</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">Confirm the Before vs After values. Saving closes the current record on the day before <strong>{form.effective_from}</strong> and creates a new history record. The old record is not overwritten.</p>
              </section>
              <div className="grid gap-2">
                <div className="hidden grid-cols-[1.2fr_1fr_1fr] px-3 text-xs font-black uppercase tracking-wide text-slate-400 sm:grid"><span>Field</span><span>Before</span><span>After</span></div>
                {reviewRows.map(([label, before, after]) => <ComparisonRow key={label} label={label} before={before} after={after} />)}
              </div>
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-black uppercase text-slate-400">Change Type</p><p className="mt-1 font-black text-slate-900">{changeLabel(form.change_type)}</p></div><div><p className="text-xs font-black uppercase text-slate-400">Effective Date</p><p className="mt-1 font-black text-slate-900">{form.effective_from}</p></div></div>
                <div className="mt-3"><p className="text-xs font-black uppercase text-slate-400">Reason / Notes</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-700">{form.change_reason}</p></div>
              </section>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          {step === 'review' ? <button type="button" onClick={() => { setNotice(null); setStep('form') }} disabled={mutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700"><FiArrowLeft />Back</button> : <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button>}
          {step === 'form' ? <button type="button" onClick={goToReview} disabled={!current || historyQuery.isLoading} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50">Review Before Saving</button> : <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60"><FiCheckCircle />{mutation.isPending ? 'Saving...' : 'Confirm Employment Change'}</button>}
        </footer>
      </div>
    </div>
  )
}

export default EmploymentChangeModal
