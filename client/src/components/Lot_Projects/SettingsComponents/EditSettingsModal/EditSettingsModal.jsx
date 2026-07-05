import { useState } from 'react'
import { FiLoader, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const Field = ({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  helper,
  required = false,
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>

    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    />

    {helper ? (
      <p className="text-xs font-semibold text-slate-500">{helper}</p>
    ) : null}
  </label>
)

const EditSettingsModal = ({ settings, onClose, onSave }) => {
  const [form, setForm] = useState(settings)
  const [alert, setAlert] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))

    if (alert?.type === 'error') {
      setAlert(null)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!form.releaseDayOne || !form.releaseDayTwo) {
      setAlert({
        type: 'error',
        message: 'Commission release days are required.',
      })
      return
    }

    if (Number(form.releaseDayOne) < 1 || Number(form.releaseDayOne) > 31) {
      setAlert({
        type: 'error',
        message: 'First release day must be between 1 and 31.',
      })
      return
    }

    if (Number(form.releaseDayTwo) < 1 || Number(form.releaseDayTwo) > 31) {
      setAlert({
        type: 'error',
        message: 'Second release day must be between 1 and 31.',
      })
      return
    }

    if (!form.reservationContactName.trim()) {
      setAlert({
        type: 'error',
        message: 'Reservation contact name is required.',
      })
      return
    }

    setIsSaving(true)
    setAlert({
      type: 'loading',
      message: 'Saving settings...',
    })

    window.setTimeout(() => {
      setIsSaving(false)
      onSave(form)
    }, 700)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              Edit Settings
            </h2>
            <p className="text-sm font-semibold text-slate-500">
              Update release days, reservation contact, and company details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close edit settings"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {alert ? (
            <div className="mb-4">
              <StatusAlert
                type={alert.type}
                message={alert.message}
                onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
              />
            </div>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-black text-slate-950">
              Commission Release Days
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Commissions can only be released on these days of the month.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field
                label="First Release Day"
                type="number"
                value={form.releaseDayOne}
                onChange={(value) => updateForm('releaseDayOne', value)}
                placeholder="Example: 7"
                helper="Allowed range: 1 to 31"
                required
              />

              <Field
                label="Second Release Day"
                type="number"
                value={form.releaseDayTwo}
                onChange={(value) => updateForm('releaseDayTwo', value)}
                placeholder="Example: 22"
                helper="Allowed range: 1 to 31"
                required
              />
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-black text-slate-950">
              Reservation Contact
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              This contact is shown for reservation assistance.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field
                label="Contact Name"
                value={form.reservationContactName}
                onChange={(value) => updateForm('reservationContactName', value)}
                placeholder="Example: D&C Prime Realty"
                required
              />

              <Field
                label="Contact Email"
                type="email"
                value={form.reservationContactEmail}
                onChange={(value) => updateForm('reservationContactEmail', value)}
                placeholder="Example: support@email.com"
              />

              <Field
                label="Contact Number"
                value={form.reservationContactNumber}
                onChange={(value) => updateForm('reservationContactNumber', value)}
                placeholder="Example: 0912-345-6789"
              />
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-black text-slate-950">
              Company Information
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Used in headers, printouts, and system displays.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field
                label="Company Name"
                value={form.companyName}
                onChange={(value) => updateForm('companyName', value)}
                placeholder="Example: D&C Prime Realty"
              />

              <Field
                label="Company Email"
                type="email"
                value={form.companyEmail}
                onChange={(value) => updateForm('companyEmail', value)}
                placeholder="Example: company@email.com"
              />

              <Field
                label="Company Contact Number"
                value={form.companyContactNumber}
                onChange={(value) => updateForm('companyContactNumber', value)}
                placeholder="Example: (046) 866-0616"
              />
            </div>
          </section>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <FiLoader className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FiSave className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditSettingsModal