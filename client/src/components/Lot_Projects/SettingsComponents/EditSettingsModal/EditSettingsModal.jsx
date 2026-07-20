import { useState } from 'react'
import { FiLoader, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const Field = ({ label, value, onChange, placeholder = '', type = 'text', helper, required = false }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>

    <input
      type={type}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    />

    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

const EditSettingsModal = ({ settings, onClose, onSave, isSaving = false }) => {
  const [form, setForm] = useState(() => ({
    releaseDayOne: settings?.releaseDayOne || '7',
    releaseDayTwo: settings?.releaseDayTwo || '22',
    reservationContactName: settings?.reservationContactName || '',
    reservationContactEmail: settings?.reservationContactEmail || '',
    reservationContactNumber: settings?.reservationContactNumber || '',
    companyName: settings?.companyName || '',
    companyEmail: settings?.companyEmail || '',
    companyContactNumber: settings?.companyContactNumber || '',
  }))
  const [alert, setAlert] = useState(null)

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))

    if (alert?.type === 'error') setAlert(null)
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!form.releaseDayOne || !form.releaseDayTwo) {
      setAlert({ type: 'error', message: 'Commission release days are required.' })
      return
    }

    const releaseDayOne = Number(form.releaseDayOne)
    const releaseDayTwo = Number(form.releaseDayTwo)

    if (!Number.isInteger(releaseDayOne) || releaseDayOne < 1 || releaseDayOne > 31) {
      setAlert({ type: 'error', message: 'First release day must be between 1 and 31.' })
      return
    }

    if (!Number.isInteger(releaseDayTwo) || releaseDayTwo < 1 || releaseDayTwo > 31) {
      setAlert({ type: 'error', message: 'Second release day must be between 1 and 31.' })
      return
    }

    if (releaseDayOne === releaseDayTwo) {
      setAlert({ type: 'error', message: 'Release days must be different.' })
      return
    }

    if (!form.reservationContactName.trim()) {
      setAlert({ type: 'error', message: 'Reservation contact name is required.' })
      return
    }

    if (!form.companyName.trim()) {
      setAlert({ type: 'error', message: 'Company name is required.' })
      return
    }

    setAlert({ type: 'loading', message: 'Saving settings to database...' })
    onSave({
      ...form,
      releaseDayOne: String(releaseDayOne),
      releaseDayTwo: String(releaseDayTwo),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form onSubmit={handleSubmit} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">Edit Settings</h2>
            <p className="text-sm font-semibold text-slate-500">Update release days, reservation contact, and company details.</p>
          </div>

          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Close edit settings">
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {alert ? (
            <div className="mb-4">
              <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} />
            </div>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-black text-slate-950">Commission Release Days</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Commissions can only be released on these days of the month.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="First Release Day" type="number" value={form.releaseDayOne} onChange={(value) => updateForm('releaseDayOne', value)} placeholder="Example: 7" helper="Allowed range: 1 to 31" required />
              <Field label="Second Release Day" type="number" value={form.releaseDayTwo} onChange={(value) => updateForm('releaseDayTwo', value)} placeholder="Example: 22" helper="Allowed range: 1 to 31" required />
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-black text-slate-950">Reservation Contact</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">This contact is shown for reservation assistance.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Contact Name" value={form.reservationContactName} onChange={(value) => updateForm('reservationContactName', value)} placeholder="D&C Prime Realty" required />
              <Field label="Contact Email" type="email" value={form.reservationContactEmail} onChange={(value) => updateForm('reservationContactEmail', value)} placeholder="reservations@example.com" />
              <Field label="Contact Number" value={form.reservationContactNumber} onChange={(value) => updateForm('reservationContactNumber', value)} placeholder="09XX-XXX-XXXX" />
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-black text-slate-950">Company Information</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Used for printouts, headers, and project documents.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Company Name" value={form.companyName} onChange={(value) => updateForm('companyName', value)} placeholder="D&C Prime Realty" required />
              <Field label="Company Email" type="email" value={form.companyEmail} onChange={(value) => updateForm('companyEmail', value)} placeholder="company@example.com" />
              <Field label="Company Contact Number" value={form.companyContactNumber} onChange={(value) => updateForm('companyContactNumber', value)} placeholder="(046) 000-0000" />
            </div>
          </section>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditSettingsModal


