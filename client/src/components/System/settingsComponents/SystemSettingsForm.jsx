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
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiSettings className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-black text-slate-950">Company Profile</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Used as fallback details across system printouts, notifications, and admin screens.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <Field label="Company Name"><input disabled={disabled} value={form.companyName} onChange={(e) => update('companyName', e.target.value)} placeholder="D&C Prime Realty" required className={inputClass} /></Field>
          <Field label="Company TIN"><input disabled={disabled} value={form.companyTin} onChange={(e) => update('companyTin', e.target.value)} placeholder="000-000-000-000" className={inputClass} /></Field>
          <Field label="Company Email"><div className="relative"><FiMail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input disabled={disabled} value={form.companyEmail} onChange={(e) => update('companyEmail', e.target.value)} placeholder="dcprimerealty@gmail.com" className={`${inputClass} w-full pl-11`} /></div></Field>
          <Field label="Company Contact Number"><div className="relative"><FiPhone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input disabled={disabled} value={form.companyContactNumber} onChange={(e) => update('companyContactNumber', e.target.value)} placeholder="(046) 866-0618" className={`${inputClass} w-full pl-11`} /></div></Field>
          <div className="md:col-span-2"><Field label="Company Address"><textarea disabled={disabled} value={form.companyAddress} onChange={(e) => update('companyAddress', e.target.value)} placeholder="Unit D, Mia's Commercial Building, Indang, Cavite" className={textareaClass} /></Field></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">Reservation & Commission Defaults</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Global fallback values. Individual lot project settings can still override project-specific contact details.</p>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <Field label="Reservation Contact Name"><input disabled={disabled} value={form.reservationContactName} onChange={(e) => update('reservationContactName', e.target.value)} placeholder="Reservation Assistance" className={inputClass} /></Field>
          <Field label="Reservation Contact Email"><input disabled={disabled} value={form.reservationContactEmail} onChange={(e) => update('reservationContactEmail', e.target.value)} placeholder="sales@dcprime.com" className={inputClass} /></Field>
          <Field label="Reservation Contact Number"><input disabled={disabled} value={form.reservationContactNumber} onChange={(e) => update('reservationContactNumber', e.target.value)} placeholder="0912-345-6789" className={inputClass} /></Field>
          <Field label="Default Release Day 1" helper="Allowed commission release day fallback."><input disabled={disabled} type="number" min="1" max="31" value={form.defaultReleaseDayOne} onChange={(e) => update('defaultReleaseDayOne', e.target.value)} className={inputClass} /></Field>
          <Field label="Default Release Day 2" helper="Allowed commission release day fallback."><input disabled={disabled} type="number" min="1" max="31" value={form.defaultReleaseDayTwo} onChange={(e) => update('defaultReleaseDayTwo', e.target.value)} className={inputClass} /></Field>
        </div>
      </section>


      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">In-House Network Pool Distribution</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Super Admin controlled. These percentages divide the distributable pool after Company Profit and must total exactly 100%.</p>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-4">
          <Field label="Division Manager" helper="Default: 14.18% of distributable pool"><div className="relative"><input disabled={disabled} type="number" min="0" max="100" step="0.0001" value={form.inHouseDmPoolSharePercent} onChange={(e) => update('inHouseDmPoolSharePercent', e.target.value)} className={`${inputClass} w-full pr-9`} /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span></div></Field>
          <Field label="Sales Director" helper="Default: 15.82% of distributable pool"><div className="relative"><input disabled={disabled} type="number" min="0" max="100" step="0.0001" value={form.inHouseSdPoolSharePercent} onChange={(e) => update('inHouseSdPoolSharePercent', e.target.value)} className={`${inputClass} w-full pr-9`} /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span></div></Field>
          <Field label="Unit Manager" helper="Default: 20% of distributable pool"><div className="relative"><input disabled={disabled} type="number" min="0" max="100" step="0.0001" value={form.inHouseUmPoolSharePercent} onChange={(e) => update('inHouseUmPoolSharePercent', e.target.value)} className={`${inputClass} w-full pr-9`} /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span></div></Field>
          <Field label="Sales Agent" helper="Default: 50% of distributable pool"><div className="relative"><input disabled={disabled} type="number" min="0" max="100" step="0.0001" value={form.inHouseSaPoolSharePercent} onChange={(e) => update('inHouseSaPoolSharePercent', e.target.value)} className={`${inputClass} w-full pr-9`} /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span></div></Field>
        </div>
        <div className="border-t border-slate-100 px-6 py-4 text-sm font-black text-slate-700">Total: {(Number(form.inHouseDmPoolSharePercent || 0) + Number(form.inHouseSdPoolSharePercent || 0) + Number(form.inHouseUmPoolSharePercent || 0) + Number(form.inHouseSaPoolSharePercent || 0)).toFixed(4)}%</div>
        <div className="grid gap-4 border-t border-slate-100 p-6 md:grid-cols-[minmax(0,1fr)_2fr] md:items-end">
          <Field label="Maximum Company Profit" helper="Highest Company Profit a Network may keep, as a percentage of its Pool Rate. At 50%, an 8% Pool Rate allows up to 4% CP."><div className="relative"><input disabled={disabled} type="number" min="0" max="100" step="0.0001" value={form.maxCompanyProfitPercentOfPool} onChange={(e) => update('maxCompanyProfitPercentOfPool', e.target.value)} className={`${inputClass} w-full pr-16`} /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">% of pool</span></div></Field>
          <p className="text-sm font-semibold text-slate-500">Applies when a Network is created or edited. Every role (DM, SD, UM, SA) must still receive at least 0.0001% after Company Profit. Existing Networks keep working until they are next edited.</p>
        </div>
        <div className="grid gap-4 border-t border-slate-100 p-6 md:grid-cols-[minmax(0,1fr)_2fr] md:items-end">
          <Field label="Maximum Company Profit" helper="Highest Company Profit a Network may keep, as a percentage of its Pool Rate. At 50%, an 8% Pool Rate allows up to 4% CP."><div className="relative"><input disabled={disabled} type="number" min="0" max="100" step="0.0001" value={form.maxCompanyProfitPercentOfPool} onChange={(e) => update('maxCompanyProfitPercentOfPool', e.target.value)} className={`${inputClass} w-full pr-16`} /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">% of pool</span></div></Field>
          <p className="text-sm font-semibold text-slate-500">Applies when a Network is created or edited. Every role (DM, SD, UM, SA) must still receive at least 0.0001% after Company Profit. Existing Networks keep working until they are next edited.</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-black text-slate-950">System Status</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Show whether the system is operating normally or under maintenance.</p>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <Field label="System Status"><select disabled={disabled} value={form.systemStatus} onChange={(e) => update('systemStatus', e.target.value)} className={inputClass}><option value="active">Active</option><option value="maintenance">Maintenance</option></select></Field>
          <Field label="Maintenance Message" helper="Required when status is Maintenance."><input disabled={disabled} value={form.maintenanceMessage} onChange={(e) => update('maintenanceMessage', e.target.value)} placeholder="System is under scheduled maintenance." className={inputClass} /></Field>
        </div>
      </section>

      {!disabled ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={isSaving} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"><FiX className="h-4 w-4" />Cancel</button>
          <button type="submit" disabled={isSaving} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"><FiSave className="h-4 w-4" />{isSaving ? 'Opening Review...' : 'Proceed to Final Review'}</button>
        </div>
      ) : null}
    </form>
  )
}

export default SystemSettingsForm
