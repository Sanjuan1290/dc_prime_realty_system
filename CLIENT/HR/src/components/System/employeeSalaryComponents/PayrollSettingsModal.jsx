import { formatPhilippineDateTime } from '../../../utils/formatDateTime'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiSave, FiSettings, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPut } from '../../../utils/useFetch'

// Keep API/database keys unchanged. Only the labels displayed to staff are simplified.
const numericFields = [
  ['regular_ot_multiplier', 'Regular Overtime Rate (× hourly pay)', '×'],
  ['rest_day_ot_multiplier', 'Rest-Day Work Rate (× hourly pay)', '×'],
]
// Historical holiday overtime columns are preserved, not exposed as new settings.
const legacyHolidayOtKeys = ['regular_holiday_ot_multiplier', 'special_holiday_ot_multiplier']
const sameHolidayRate = (data) => data.regular_holiday_multiplier === data.special_holiday_multiplier

const cleanInput = (value) => value === null || value === undefined ? '' : String(value)
const payloadValue = (value) => String(value ?? '').trim() === '' ? null : Number(value)

// Maps the simple On/Off controls to the existing approved payroll policies.
const PayrollToggle = ({ id, title, description, checked, highlighted = false, onChange }) => (
  <section id={id} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${highlighted ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-white'}`}>
    <div className="min-w-0">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
    </div>
    <div className="flex shrink-0 items-center gap-3 sm:ml-4">
      <span className={`text-sm font-semibold ${checked ? 'text-emerald-700' : 'text-slate-500'}`}>{checked ? 'On' : 'Off'}</span>
      <button
        type="button"
        role="switch"
        aria-label={title}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-150 ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
      </button>
    </div>
  </section>
)

const PayrollSettingsModal = ({ onClose, onSaved, initialSection = null }) => {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: ['employee-salary', 'payroll-settings'],
    queryFn: () => useFetch('/employee-payroll/settings'),
  })
  const [form, setForm] = useState(null)
  const settingsBodyRef = useRef(null)
  useEffect(() => {
    if (initialSection === 'attendance-bonus' && form && settingsBodyRef.current) {
      const item = settingsBodyRef.current.querySelector('#attendance-bonus-settings')
      if (item) settingsBodyRef.current.scrollTop = Math.max(0, item.offsetTop - settingsBodyRef.current.offsetTop - 28)
    }
  }, [initialSection, Boolean(form)])

  useEffect(() => {
    if (!settingsQuery.data?.data) return
    const data = settingsQuery.data.data
    setForm({
      ...Object.fromEntries(numericFields.map(([key]) => [key, cleanInput(data[key])])),
      ...Object.fromEntries(legacyHolidayOtKeys.map((key) => [key, cleanInput(data[key])])),
      holiday_multiplier: sameHolidayRate(data) ? cleanInput(data.regular_holiday_multiplier) : '',
      night_differential_percentage: cleanInput(data.night_differential_percentage),
      mid_period_change_rule: data.mid_period_change_rule || 'period_boundary_only',
      first_half_payday: cleanInput(data.first_half_payday ?? 22),
      second_half_payday: cleanInput(data.second_half_payday ?? 7),
      new_hire_proration_rule: data.new_hire_proration_rule || 'scheduled_workdays',
      attendance_bonus_rule: data.attendance_bonus_rule || 'perfect_attendance_per_period',
    })
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => useFetchPut('/employee-payroll/settings', {
      ...Object.fromEntries(numericFields.map(([key]) => [key, payloadValue(form?.[key])])),
      regular_holiday_multiplier: payloadValue(form?.holiday_multiplier),
      special_holiday_multiplier: payloadValue(form?.holiday_multiplier),
      ...Object.fromEntries(legacyHolidayOtKeys.map((key) => [key, payloadValue(form?.[key])])),
      night_differential_percentage: payloadValue(form?.night_differential_percentage),
      mid_period_change_rule: 'period_boundary_only',
      first_half_payday: Number(form?.first_half_payday),
      second_half_payday: Number(form?.second_half_payday),
      new_hire_proration_rule: form?.new_hire_proration_rule || 'scheduled_workdays',
      attendance_bonus_rule: form?.attendance_bonus_rule || 'perfect_attendance_per_period',
    }, { confirmationHandled: 'compact' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employee-salary'] })
      onSaved?.(result)
      onClose?.()
    },
  })

  const holidayRatesDiffer = settingsQuery.data?.data && !sameHolidayRate(settingsQuery.data.data)
  const sharedHolidayRateRequired = holidayRatesDiffer && String(form?.holiday_multiplier ?? '').trim() === ''
  const set = (key, value) => setForm((current) => ({ ...(current || {}), [key]: value }))

  const fieldClass = 'mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
  const fieldCardClass = 'rounded-xl border border-slate-200 bg-white p-4'

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-slate-950"><FiSettings className="text-blue-600" /><h2 className="text-xl font-black">Payroll Settings</h2></div>
          <button type="button" onClick={onClose} aria-label="Close Payroll Settings" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><FiX /></button>
        </header>

        <div ref={settingsBodyRef} className="space-y-5 overflow-y-auto p-5 sm:p-6">
          {settingsQuery.isLoading ? <StatusAlert type="loading" message="Loading payroll settings..." /> : null}
          {settingsQuery.isError ? <StatusAlert type="error" message={settingsQuery.error?.message || 'Unable to load payroll settings.'} /> : null}
          {saveMutation.isError ? <StatusAlert type="error" message={saveMutation.error?.message || 'Unable to save payroll settings.'} /> : null}

          {form ? <>
            <section>
              <h3 className="mb-3 text-base font-black text-slate-900">Paydays</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={fieldCardClass}>
                  <span className="block text-sm font-bold text-slate-800">Payday for 1st–15th (same month)</span>
                  <input type="number" min="16" max="28" value={form.first_half_payday} onChange={(event) => set('first_half_payday', event.target.value)} className={fieldClass} />
                </label>
                <label className={fieldCardClass}>
                  <span className="block text-sm font-bold text-slate-800">Payday for 16th–month end (next month)</span>
                  <input type="number" min="1" max="28" value={form.second_half_payday} onChange={(event) => set('second_half_payday', event.target.value)} className={fieldClass} />
                </label>
              </div>
            </section>

            <PayrollToggle
              title="Pay for newly hired employees"
              description="Pay only scheduled workdays from their hire date in their first pay period."
              checked={form.new_hire_proration_rule === 'scheduled_workdays'}
              onChange={(enabled) => set('new_hire_proration_rule', enabled ? 'scheduled_workdays' : 'disabled')}
            />

            <PayrollToggle
              id="attendance-bonus-settings"
              highlighted={initialSection === 'attendance-bonus'}
              title="Attendance Bonus"
              description="Pay the employee's saved bonus after a completed pay period, if their attendance has no late or absent time and all time records are complete."
              checked={form.attendance_bonus_rule === 'perfect_attendance_per_period'}
              onChange={(enabled) => set('attendance_bonus_rule', enabled ? 'perfect_attendance_per_period' : 'disabled')}
            />

            <section>
              <h3 className="text-base font-black text-slate-900">Extra Pay Rates</h3>
              <p className="mt-1 mb-3 text-xs font-medium text-slate-600">Enter company-approved rates only. Leave unapproved rates blank; extra pay for those hours will be ₱0.00 in a draft.</p>
              {holidayRatesDiffer ? <p role="alert" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Existing holiday rates differ. Enter one approved Holiday Pay Rate before saving.</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {numericFields.map(([key, label, unit]) => (
                  <label key={key} className={fieldCardClass}>
                    <span className="block text-sm font-bold text-slate-800">{label}</span>
                    <div className="relative">
                      <input type="number" min="0" step="0.0001" value={form[key]} onChange={(event) => set(key, event.target.value)} placeholder="Not set" className={`${fieldClass} pr-10`} />
                      <span className="pointer-events-none absolute right-4 top-[1.15rem] text-sm font-bold text-slate-500">{unit}</span>
                    </div>
                  </label>
                ))}
                <label className={fieldCardClass}>
                  <span className="block text-sm font-bold text-slate-800">Holiday Pay Rate (× hourly pay)</span>
                  <div className="relative">
                    <input type="number" min="0" step="0.0001" value={form.holiday_multiplier} onChange={(event) => set('holiday_multiplier', event.target.value)} placeholder="Not set" className={`${fieldClass} pr-10`} />
                    <span className="pointer-events-none absolute right-4 top-[1.15rem] text-sm font-bold text-slate-500">×</span>
                  </div>
                </label>
                <label className={fieldCardClass}>
                  <span className="block text-sm font-bold text-slate-800">Night Shift Extra Pay</span>
                  <div className="relative">
                    <input type="number" min="0" max="100" step="0.001" value={form.night_differential_percentage} onChange={(event) => set('night_differential_percentage', event.target.value)} placeholder="Not set" className={`${fieldClass} pr-10`} />
                    <span className="pointer-events-none absolute right-4 top-[1.15rem] text-sm font-bold text-slate-500">%</span>
                  </div>
                </label>
              </div>
            </section>

            <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-bold text-slate-700">Settings history</summary>
              <div className="mt-2 space-y-1">
                <p>Version: {settingsQuery.data?.data?.settings_revision ?? '—'}</p>
                <p>Last saved: {settingsQuery.data?.data?.updated_at ? formatPhilippineDateTime(settingsQuery.data.data.updated_at, { timeZoneLabel: true }) : 'Not yet saved'}</p>
                <p>Saved by: {settingsQuery.data?.data?.updated_by_name || '—'}</p>
                <p>Previously finalized and released payroll is not changed. Recalculate existing drafts before finalizing.</p>
              </div>
            </details>
          </> : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700">Cancel</button>
          <button type="button" onClick={() => saveMutation.mutate()} disabled={!form || saveMutation.isPending || sharedHolidayRateRequired} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"><FiSave />{saveMutation.isPending ? 'Saving...' : 'Save Changes'}</button>
        </footer>
      </div>
    </div>
  )
}

export default PayrollSettingsModal







