import { useMemo, useState } from 'react'
import { FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const today = () => new Date().toISOString().slice(0, 10)

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const Field = ({ label, value, onChange, type = 'text', placeholder = '', disabled = false, helper }) => (
  <label className="flex flex-col gap-2">
    <span className="text-sm font-black text-slate-700">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    />
    {helper ? <span className="text-xs font-semibold text-slate-500">{helper}</span> : null}
  </label>
)

const AddPaymentModal = ({ listing = {}, onClose, onSave, isSaving = false }) => {
  const [form, setForm] = useState({
    paymentType: 'monthly_amortization',
    paymentMethod: 'Cash',
    amount: '',
    paymentDate: today(),
    referenceId: '',
    remarks: '',
  })
  const [alert, setAlert] = useState(null)

  const isCash = form.paymentMethod === 'Cash'
  const referencePreview = useMemo(
    () => (isCash ? 'Auto-generated after saving' : form.referenceId),
    [isCash, form.referenceId]
  )

  const update = (key, value) => {
    setAlert(null)
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    const amount = Number(form.amount || 0)

    if (!amount || amount <= 0) {
      setAlert({ type: 'error', message: 'Amount must be greater than zero.' })
      return
    }

    if (!isCash && !String(form.referenceId || '').trim()) {
      setAlert({ type: 'error', message: 'Reference ID is required for non-cash payments.' })
      return
    }

    setAlert({ type: 'loading', message: 'Saving payment...' })

    try {
      await onSave?.({
        paymentType: form.paymentType,
        paymentMethod: form.paymentMethod,
        amount,
        paymentDate: form.paymentDate,
        referenceId: isCash ? '' : form.referenceId.trim(),
        remarks: form.remarks.trim(),
      })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Payment was not saved.' })
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <form onSubmit={submit} className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">Add Payment</h2>
            <p className="text-sm font-semibold text-slate-500">Payments are saved through the active backend flow and verified by admin.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-10 w-10 items-center justify-center rounded-2xl hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Close add payment modal"><FiX /></button>
        </div>

        <div className="p-6">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} className="mb-4" /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-black text-slate-700">Payment Type</span>
              <select value={form.paymentType} onChange={(event) => update('paymentType', event.target.value)} disabled={isSaving} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="reservation">Reservation Fee</option>
                <option value="downpayment">Downpayment</option>
                <option value="monthly_amortization">Monthly Amortization</option>
                <option value="advance_payment">Advance Payment</option>
                <option value="balloon">Balloon Payment</option>
                <option value="full_payment">Full Payment</option>
                <option value="legal_misc">Legal / Misc Fee</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-black text-slate-700">Method</span>
              <select value={form.paymentMethod} onChange={(event) => update('paymentMethod', event.target.value)} disabled={isSaving} className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Online Payment">Online Payment</option>
                <option value="Check">Check</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <Field label="Amount" value={form.amount} onChange={(value) => update('amount', value)} type="number" placeholder="Enter amount paid" disabled={isSaving} />
            <Field label="Payment Date" value={form.paymentDate} onChange={(value) => update('paymentDate', value)} type="date" disabled={isSaving} />
            <Field label="Reference ID" value={referencePreview} onChange={(value) => update('referenceId', value)} placeholder="Enter transaction reference" disabled={isSaving || isCash} helper={isCash ? 'Cash reference is auto-generated after saving.' : 'Required for non-cash payments.'} />
            <Field label="Remarks" value={form.remarks} onChange={(value) => update('remarks', value)} placeholder="Optional remarks" disabled={isSaving} />
          </div>

          <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-800">
            Amount preview: <span className="font-black">{money(form.amount)}</span>
            {listing.unitCode || listing.unit_id ? <span className="ml-2 text-blue-700">• Unit {listing.unitCode || listing.unit_id}</span> : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-11 rounded-2xl border border-slate-200 px-5 text-sm font-black transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={isSaving} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"><FiSave />{isSaving ? 'Saving...' : 'Save Payment'}</button>
        </div>
      </form>
    </div>
  )
}

export default AddPaymentModal


