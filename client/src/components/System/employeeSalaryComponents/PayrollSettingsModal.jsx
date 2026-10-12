import { formatPhilippineDateTime } from '../../../utils/formatDateTime'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiSave, FiSettings, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPut } from '../../../utils/useFetch'

// Keep API/database keys unchanged. Only the labels displayed to staff are simplified.
const numericFields = [
  ['regular_ot_multiplier', 'Regular Overtime Rate (× hourly pay)', '×'],
  ['rest_day_ot_multiplier', 'Rest Day Overtime Rate (× hourly pay)', '×'],
]
// Historical holiday overtime columns are preserved, not exposed as new settings.
const legacyHolidayOtKeys = ['regular_holiday_ot_multiplier', 'special_holiday_ot_multiplier']
const sameHolidayRate = (data) => data.regular_holiday_multiplier === data.special_holiday_multiplier

const cleanInput = (value) => value === null || value === undefined ? '' : String(value)
const payloadValue = (value) => String(value ?? '').trim() === '' ? null : Number(value)

const PayrollSettingsModal = ({ onClose, onSaved }) => {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: ['employee-salary', 'payroll-settings'],
    queryFn: () => useFetch('/employee-payroll/settings'),
  })
  const [form, setForm] = useState(null)

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
      new_hire_proration_rule: data.new_hire_proration_rule || 'disabled',
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
      new_hire_proration_rule: form?.new_hire_proration_rule || 'disabled',
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

        <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
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

            <section>
              <h3 className="mb-3 text-base font-black text-slate-900">New Employee's First Pay</h3>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-800">If hired during a pay period</span>
                <select value={form.new_hire_proration_rule} onChange={(event) => set('new_hire_proration_rule', event.target.value)} className={`${fieldClass} mt-0`}>
                  <option value="disabled">Do not calculate partial pay (approval needed)</option>
                  <option value="scheduled_workdays">Approved: Pay for scheduled workdays after hiring</option>
                </select>
              </label>
            </section>

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
