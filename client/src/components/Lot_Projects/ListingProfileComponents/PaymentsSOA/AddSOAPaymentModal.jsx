import { useMemo, useState } from 'react'
import { FiAlertCircle, FiCreditCard, FiLoader, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))
const todayISO = () => new Date().toISOString().slice(0, 10)

const getSuggestedRow = (rows = []) => rows.find((row) => ['Unpaid', 'Partial', 'Overdue'].includes(row.status)) || rows[0]
const getPaymentTypeFromDescription = (description = '') => {
  const text = description.toLowerCase()
  if (text.includes('reservation')) return 'reservation'
  if (text.includes('downpayment')) return 'downpayment'
  if (text.includes('legal') || text.includes('misc')) return 'legal_misc'
  if (text.includes('full')) return 'full_payment'
  return 'monthly_amortization'
}
const generateCashReference = (unitCode) => `CASH-${todayISO().replaceAll('-', '')}-${String(unitCode || 'UNIT').replace(/[^a-zA-Z0-9]/g, '')}-AUTO`

const Field = ({ label, value, onChange, type = 'text', placeholder = '', helper, required = false, disabled = false, max }) => (
  <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">{label} {required ? <span className="text-red-500">*</span> : null}</span><input type={type} value={value} max={max} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} className={`h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 ${disabled ? 'cursor-not-allowed bg-slate-100 text-slate-500' : 'bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50'}`} />{helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}</label>
)
const SelectField = ({ label, value, onChange, children, helper, required = false }) => (
  <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">{label} {required ? <span className="text-red-500">*</span> : null}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50">{children}</select>{helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}</label>
)

const AddSOAPaymentModal = ({ listing = {}, rows = [], onClose, onSave, isSaving = false }) => {
  const suggestedRow = getSuggestedRow(rows)
  const [alert, setAlert] = useState(null)
  const [form, setForm] = useState({
    soaRowId: String(suggestedRow?.id || ''),
    paymentType: getPaymentTypeFromDescription(suggestedRow?.description || ''),
    amount: String(Math.max(Number(suggestedRow?.dueAmount || 0) + Number(suggestedRow?.penalty || 0) - Number(suggestedRow?.amountPaid || 0), 0)),
    paymentDate: todayISO(),
    method: 'Cash',
    referenceId: '',
  })

  const selectedRow = useMemo(() => rows.find((row) => String(row.id) === String(form.soaRowId)), [rows, form.soaRowId])
  const suggestedAmount = Math.max(Number(selectedRow?.dueAmount || 0) + Number(selectedRow?.penalty || 0) - Number(selectedRow?.amountPaid || 0), 0)

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value, ...(key === 'method' && value === 'Cash' ? { referenceId: generateCashReference(listing.unit_id || listing.unitCode) } : {}) }))
    if (alert?.type === 'error') setAlert(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.soaRowId) return setAlert({ type: 'error', message: 'Select the SOA row this payment applies to.' })
    if (Number(form.amount) <= 0) return setAlert({ type: 'error', message: 'Payment amount must be greater than 0.' })
    if (form.method !== 'Cash' && !form.referenceId.trim()) return setAlert({ type: 'error', message: 'Reference ID / OR No. / Transaction No. is required for non-cash payments.' })
    await onSave?.({ ...form, referenceId: form.method === 'Cash' ? form.referenceId || generateCashReference(listing.unit_id || listing.unitCode) : form.referenceId })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form onSubmit={handleSubmit} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><h3 className="text-xl font-black text-slate-950">Add Payment</h3><p className="mt-1 text-sm font-semibold text-slate-500">Record a verified collection and update the SOA schedule.</p></div><button type="button" onClick={onClose} disabled={isSaving} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"><FiX className="h-5 w-5" /></button></div>
        <div className="flex-1 overflow-y-auto p-6">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} className="mb-4" /> : null}
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800"><div className="flex gap-3"><FiCreditCard className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">{listing.unit_id || listing.unitCode} · {listing.buyer_name || 'No buyer name'}</p><p className="mt-1">Suggested amount for selected row: {money(suggestedAmount)}</p></div></div></div>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="SOA Row" value={form.soaRowId} onChange={(value) => updateField('soaRowId', value)} required>{rows.map((row) => <option key={row.id} value={row.id}>{row.description} · {money(row.dueAmount)} · {row.status}</option>)}</SelectField>
            <SelectField label="Payment Type" value={form.paymentType} onChange={(value) => updateField('paymentType', value)} required><option value="reservation">Reservation</option><option value="downpayment">Downpayment</option><option value="monthly_amortization">Monthly Amortization</option><option value="legal_misc">Legal / Misc</option><option value="full_payment">Full Payment</option><option value="other">Other</option></SelectField>
            <Field label="Amount Paid" type="number" value={form.amount} onChange={(value) => updateField('amount', value)} placeholder="Example: 50000" required />
            <Field label="Payment Date" type="date" max={todayISO()} value={form.paymentDate} onChange={(value) => updateField('paymentDate', value)} required />
            <SelectField label="Payment Method" value={form.method} onChange={(value) => updateField('method', value)} required><option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option><option value="Online Payment">Online Payment</option><option value="Check">Check</option><option value="Other">Other</option></SelectField>
            <Field label="Reference ID / OR No." value={form.referenceId} onChange={(value) => updateField('referenceId', value)} placeholder={form.method === 'Cash' ? 'Auto-generated if blank' : 'Required for non-cash payments'} helper={form.method === 'Cash' ? 'Cash reference can be auto-generated.' : 'Bank/online/check payments require a reference number.'} required={form.method !== 'Cash'} />
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800"><FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0" />This payment will be saved as verified and reflected in the SOA schedule.</div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4"><button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">Cancel</button><button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-300">{isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCreditCard className="h-4 w-4" />}{isSaving ? 'Saving...' : 'Save Payment'}</button></div>
      </form>
    </div>
  )
}

export default AddSOAPaymentModal
