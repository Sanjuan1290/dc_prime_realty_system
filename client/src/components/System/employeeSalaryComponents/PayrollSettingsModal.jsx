import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiAlertTriangle, FiSave, FiSettings, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPut } from '../../../utils/useFetch'

const numericFields = [
  ['regular_ot_multiplier', 'Regular OT Multiplier', 'Applied to Regular OT hours.'],
  ['rest_day_ot_multiplier', 'Rest Day OT Multiplier', 'Applied to Rest Day OT hours.'],
  ['regular_holiday_multiplier', 'Regular Holiday Multiplier', 'Applied to recorded Regular Holiday worked hours.'],
  ['regular_holiday_ot_multiplier', 'Regular Holiday OT Multiplier', 'Stored for the approved rule; current Attendance does not yet expose separate Regular Holiday OT minutes.'],
  ['special_holiday_multiplier', 'Special Holiday Multiplier', 'Applied to recorded Special Holiday worked hours.'],
  ['special_holiday_ot_multiplier', 'Special Holiday OT Multiplier', 'Stored for the approved rule; current Attendance does not yet expose separate Special Holiday OT minutes.'],
]

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
      night_differential_percentage: cleanInput(data.night_differential_percentage),
      mid_period_change_rule: data.mid_period_change_rule || 'period_boundary_only',
    })
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => useFetchPut('/employee-payroll/settings', {
      ...Object.fromEntries(numericFields.map(([key]) => [key, payloadValue(form?.[key])])),
      night_differential_percentage: payloadValue(form?.night_differential_percentage),
      mid_period_change_rule: 'period_boundary_only',
    }, { confirmationHandled: 'compact' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employee-salary'] })
      onSaved?.(result)
      onClose?.()
    },
  })

  const set = (key, value) => setForm((current) => ({ ...(current || {}), [key]: value }))

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-blue-700"><FiSettings /><p className="text-xs font-black uppercase tracking-wider">Employee Salary</p></div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Payroll Settings</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Configure company-approved premium-pay rules. No payroll multiplier is hardcoded by this module.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          {settingsQuery.isLoading ? <StatusAlert type="loading" message="Loading Payroll Settings..." /> : null}
          {settingsQuery.isError ? <StatusAlert type="error" message={settingsQuery.error?.message || 'Unable to load Payroll Settings.'} /> : null}
          {saveMutation.isError ? <div className="mb-4"><StatusAlert type="error" message={saveMutation.error?.message || 'Unable to save Payroll Settings.'} /></div> : null}

          {form ? <div className="space-y-5">
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3"><FiAlertTriangle className="mt-0.5 shrink-0 text-amber-700" /><div><p className="font-black text-amber-950">Enter only company-approved rates</p><p className="mt-1 text-sm font-semibold leading-6 text-amber-900">The Master Plan names these rules but does not provide their numeric values. Leave a field blank until the company confirms it. Recorded premium hours with an unconfigured rate remain ₱0.00 and produce a Draft warning.</p></div></div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              {numericFields.map(([key, label, help]) => <label key={key} className="rounded-2xl border border-slate-200 p-4"><span className="block text-sm font-black text-slate-900">{label}</span><input type="number" min="0" step="0.0001" value={form[key]} onChange={(event) => set(key, event.target.value)} placeholder="Not configured" className="mt-3 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold" /><span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">{help}</span></label>)}
              <label className="rounded-2xl border border-slate-200 p-4"><span className="block text-sm font-black text-slate-900">Night Differential Percentage</span><div className="relative mt-3"><input type="number" min="0" max="100" step="0.001" value={form.night_differential_percentage} onChange={(event) => set('night_differential_percentage', event.target.value)} placeholder="Not configured" className="h-11 w-full rounded-xl border border-slate-300 px-3 pr-10 text-sm font-bold" /><span className="absolute right-3 top-3 text-sm font-black text-slate-500">%</span></div><span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">Applied as an additional percentage of hourly pay for recorded Night Differential hours.</span></label>
              <label className="rounded-2xl border border-slate-200 p-4"><span className="block text-sm font-black text-slate-900">Mid-Period Salary Change Rule</span><select value="period_boundary_only" disabled className="mt-3 h-11 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 text-sm font-bold text-slate-700"><option value="period_boundary_only">Payroll Boundary Only — 1st or 16th</option></select><span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">A proration formula is not defined in the approved Master Plan, so salary/compensation changes inside a half-month period remain blocked.</span></label>
            </section>

            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-950">
              <p><strong>Settings revision:</strong> {settingsQuery.data?.data?.settings_revision ?? '—'}</p>
              <p><strong>Last updated:</strong> {settingsQuery.data?.data?.updated_at ? new Date(settingsQuery.data.data.updated_at).toLocaleString() : 'Not yet updated'}</p>
              <p><strong>Updated by:</strong> {settingsQuery.data?.data?.updated_by_name || '—'}</p>
              <p className="mt-2">Changing settings does not alter Finalized/Corrected/Released payroll. Existing Draft payroll must be recalculated before Finalization.</p>
            </section>
          </div> : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancel</button>
          <button type="button" onClick={() => saveMutation.mutate()} disabled={!form || saveMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"><FiSave />{saveMutation.isPending ? 'Saving...' : 'Save Payroll Settings'}</button>
        </footer>
      </div>
    </div>
  )
}

export default PayrollSettingsModal

