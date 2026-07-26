import { FiMail, FiPhone, FiSave, FiSettings, FiX } from 'react-icons/fi'

const Field = ({ label, helper, children }) => (
  <label className="grid gap-2">
    <span className="text-sm font-black text-slate-700">{label}</span>
    {children}
    {helper ? <span className="text-xs font-semibold text-slate-500">{helper}</span> : null}
  </label>
)

const inputClass = 'h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'
const textareaClass = 'min-h-[110px] resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

const SystemSettingsForm = ({ form, setForm, onSubmit, isSaving, disabled = false, onCancel }) => {
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <FiSettings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">Company Profile</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Used as fallback details across system printouts, notifications, and admin screens.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          <Field label="Company Name">
            <input disabled={disabled} value={form.companyName} onChange={(e) => update('companyName', e.target.value)} placeholder="D&C Prime Realty" required className={inputClass} />
          </Field>
          <Field label="Company TIN">
            <input disabled={disabled} value={form.companyTin} onChange={(e) => update('companyTin', e.target.value)} placeholder="000-000-000-000" className={inputClass} />
          </Field>
          <Field label="Company Email">
            <div className="relative">
              <FiMail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input disabled={disabled} value={form.companyEmail} onChange={(e) => update('companyEmail', e.target.value)} placeholder="dcprimerealty@gmail.com" className={`${inputClass} w-full pl-11`} />
            </div>
          </Field>
          <Field label="Company Contact Number">
            <div className="relative">
              <FiPhone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input disabled={disabled} value={form.companyContactNumber} onChange={(e) => update('companyContactNumber', e.target.value)} placeholder="(046) 866-0618" className={`${inputClass} w-full pl-11`} />
            </div>
          </Field>
          <div className="md:col-span-2">
            <Field label="Company Address">
              <textarea disabled={disabled} value={form.companyAddress} onChange={(e) => update('companyAddress', e.target.value)} placeholder="Unit D, Mia's Commercial Building, Indang, Cavite" className={textareaClass} />
            </Field>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">Reservation & Commission Defaults</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Global fallback values. Individual lot project settings can still override project-specific contact details.</p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-3">
          <Field label="Reservation Contact Name">
            <input disabled={disabled} value={form.reservationContactName} onChange={(e) => update('reservationContactName', e.target.value)} placeholder="Reservation Assistance" className={inputClass} />
          </Field>
          <Field label="Reservation Contact Email">
            <input disabled={disabled} value={form.reservationContactEmail} onChange={(e) => update('reservationContactEmail', e.target.value)} placeholder="sales@dcprime.com" className={inputClass} />
          </Field>
          <Field label="Reservation Contact Number">
            <input disabled={disabled} value={form.reservationContactNumber} onChange={(e) => update('reservationContactNumber', e.target.value)} placeholder="0912-345-6789" className={inputClass} />
          </Field>
          <Field label="Default Release Day 1" helper="Allowed commission release day fallback.">
            <input disabled={disabled} type="number" min="1" max="31" value={form.defaultReleaseDayOne} onChange={(e) => update('defaultReleaseDayOne', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Default Release Day 2" helper="Allowed commission release day fallback.">
            <input disabled={disabled} type="number" min="1" max="31" value={form.defaultReleaseDayTwo} onChange={(e) => update('defaultReleaseDayTwo', e.target.value)} className={inputClass} />
          </Field>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">System Status</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Show whether the system is operating normally or under maintenance.</p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          <Field label="System Status">
            <select disabled={disabled} value={form.systemStatus} onChange={(e) => update('systemStatus', e.target.value)} className={inputClass}>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </Field>
          <Field label="Maintenance Message" helper="Required when status is Maintenance.">
            <input disabled={disabled} value={form.maintenanceMessage} onChange={(e) => update('maintenanceMessage', e.target.value)} placeholder="System is under scheduled maintenance." className={inputClass} />
          </Field>
        </div>
      </section>

      {!disabled ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiX className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSave className="h-4 w-4" />
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      ) : null}
    </form>
  )
}

export default SystemSettingsForm

