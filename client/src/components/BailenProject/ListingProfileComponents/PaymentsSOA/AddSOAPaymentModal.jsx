import { useMemo, useState } from 'react'
import { FiAlertCircle, FiCreditCard, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const todayISO = () => new Date().toISOString().slice(0, 10)

const getListingValue = (listing, keys, fallback = '') => {
  for (const key of keys) {
    if (
      listing?.[key] !== undefined &&
      listing?.[key] !== null &&
      listing?.[key] !== ''
    ) {
      return listing[key]
    }
  }

  return fallback
}

const getSuggestedRow = (rows = []) => {
  return (
    rows.find((row) => {
      const status = String(row.status || '').toLowerCase()
      const amountPaid = Number(row.amountPaid || 0)
      const totalDue =
        Number(row.dueAmount || 0) +
        Number(row.interest || 0) +
        Number(row.penalty || 0)

      return (status === 'unpaid' || status === 'pending') && amountPaid < totalDue
    }) || rows[0]
  )
}

const getPaymentTypeFromDescription = (description = '') => {
  const text = description.toLowerCase()

  if (text.includes('reservation')) return 'Reservation'
  if (text.includes('downpayment')) return 'Downpayment'
  if (text.includes('legal') || text.includes('misc')) return 'Legal / Misc'
  if (text.includes('full')) return 'Full Payment'
  if (text.includes('advance')) return 'Advance Payment'
  if (text.includes('offset')) return 'Offset Payment'
  if (text.includes('balloon')) return 'Balloon Payment'

  return 'Monthly'
}

const generateCashReference = (unitCode) => {
  const date = todayISO().replaceAll('-', '')
  const cleanUnit = String(unitCode || 'UNIT').replace(/[^a-zA-Z0-9]/g, '')
  return `CASH-${date}-${cleanUnit}-0001`
}

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  helper,
  required = false,
  disabled = false,
  max,
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>

    <input
      type={type}
      value={value}
      max={max}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 ${
        disabled
          ? 'cursor-not-allowed bg-slate-100 text-slate-500'
          : 'bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50'
      }`}
    />

    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

const SelectField = ({ label, value, onChange, children, helper, required = false }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>

    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    >
      {children}
    </select>

    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

const AddSOAPaymentModal = ({ listing = {}, rows = [], onClose, onSave }) => {
  const suggestedRow = getSuggestedRow(rows)

  const unitCode = getListingValue(
    listing,
    ['unit_id', 'unitCode', 'unitNo'],
    'LA-0402'
  )

  const buyerName = getListingValue(
    listing,
    ['buyer_name', 'buyerName', 'clientName'],
    'robert'
  )

  const projectName = getListingValue(
    listing,
    ['project_name', 'projectName'],
    'Bailen Project'
  )

  const [alert, setAlert] = useState(null)

  const [form, setForm] = useState({
    soaRowId: String(suggestedRow?.id || ''),
    paymentType: getPaymentTypeFromDescription(suggestedRow?.description),
    amount: String(
      Number(suggestedRow?.dueAmount || 0) +
        Number(suggestedRow?.interest || 0) +
        Number(suggestedRow?.penalty || 0)
    ),
    paymentDate: todayISO(),
    method: 'Cash',
    referenceId: '',
    status: 'Verified',
  })

  const selectedRow = useMemo(
    () => rows.find((row) => String(row.id) === String(form.soaRowId)),
    [rows, form.soaRowId]
  )

  const suggestedAmount = useMemo(() => {
    if (!selectedRow) return 0

    return (
      Number(selectedRow.dueAmount || 0) +
      Number(selectedRow.interest || 0) +
      Number(selectedRow.penalty || 0)
    )
  }, [selectedRow])

  const automaticInterest = Number(selectedRow?.interest || 0)
  const automaticPenalty = Number(selectedRow?.penalty || 0)

  const updateField = (key, value) => {
    setForm((current) => {
      const next = {
        ...current,
        [key]: value,
      }

      if (key === 'method' && value !== 'Cash') {
        next.referenceId = ''
      }

      return next
    })

    if (alert?.type === 'error') {
      setAlert(null)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!form.soaRowId) {
      setAlert({
        type: 'error',
        message: 'No SOA row is available for payment.',
      })
      return
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setAlert({ type: 'error', message: 'Payment amount is required.' })
      return
    }

    if (form.paymentDate > todayISO()) {
      setAlert({
        type: 'error',
        message:
          'Future payment dates are blocked. Use Advance Payment if the buyer pays ahead.',
      })
      return
    }

    if (form.method !== 'Cash' && !form.referenceId.trim()) {
      setAlert({
        type: 'error',
        message:
          'Reference ID / OR No. / Transaction No. is required for non-cash payments.',
      })
      return
    }

    const referenceId =
      form.method === 'Cash'
        ? generateCashReference(unitCode)
        : form.referenceId.trim()

    setAlert({ type: 'loading', message: 'Saving payment in mock mode...' })

    window.setTimeout(() => {
      onSave({
        ...form,
        amount: Number(form.amount || 0),
        interest: automaticInterest,
        penalty: automaticPenalty,
        referenceId,
      })
    }, 600)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">Add Payment</h2>
            <p className="text-sm font-semibold text-slate-500">
              {buyerName} · {unitCode} · {projectName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close modal"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {alert ? (
            <StatusAlert
              type={alert.type}
              message={alert.message}
              onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
              className="mb-4"
            />
          ) : null}

          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <FiCreditCard className="mt-1 h-5 w-5 text-blue-700" />

              <div>
                <p className="text-sm font-black text-blue-900">Selected Unit</p>
                <p className="mt-1 text-sm font-semibold text-blue-800">
                  {buyerName} · {unitCode} · {projectName}
                </p>

                {selectedRow ? (
                  <p className="mt-1 text-xs font-semibold text-blue-700">
                    Payment will apply to next unpaid SOA row:{' '}
                    <span className="font-black">{selectedRow.description}</span> ·{' '}
                    {money(suggestedAmount)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-semibold text-red-700">
                    No unpaid SOA row available.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Due Amount</p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {money(selectedRow?.dueAmount || 0)}
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase text-amber-700">
                Interest
              </p>
              <p className="mt-1 text-lg font-black text-amber-900">
                {money(automaticInterest)}
              </p>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-black uppercase text-red-700">
                Penalty
              </p>
              <p className="mt-1 text-lg font-black text-red-900">
                {money(automaticPenalty)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Payment Type"
              value={form.paymentType}
              onChange={(value) => updateField('paymentType', value)}
              required
            >
              <option value="Reservation">Reservation</option>
              <option value="Downpayment">Downpayment</option>
              <option value="Monthly">Monthly</option>
              <option value="Legal / Misc">Legal / Misc</option>
              <option value="Full Payment">Full Payment</option>
              <option value="Advance Payment">Advance Payment</option>
              <option value="Offset Payment">Offset Payment</option>
              <option value="Balloon Payment">Balloon Payment</option>
              <option value="Other">Other</option>
            </SelectField>

            <Field
              label="Amount"
              type="number"
              value={form.amount}
              onChange={(value) => updateField('amount', value)}
              placeholder="0.00"
              helper={`Suggested amount: ${money(suggestedAmount)}`}
              required
            />

            <Field
              label="Payment Date"
              type="date"
              value={form.paymentDate}
              max={todayISO()}
              onChange={(value) => updateField('paymentDate', value)}
              helper="Future dates are blocked. To pay ahead of a monthly due, choose Advance Payment instead."
              required
            />

            <SelectField
              label="Payment Method"
              value={form.method}
              onChange={(value) => updateField('method', value)}
              required
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Online Transfer">Online Transfer</option>
              <option value="GCash">GCash</option>
              <option value="Check">Check</option>
              <option value="Other">Other</option>
            </SelectField>

            <SelectField
              label="Status"
              value={form.status}
              onChange={(value) => updateField('status', value)}
              required
            >
              <option value="Verified">Verified</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </SelectField>

            <div className="md:col-span-2">
              <Field
                label="Reference ID / OR No. / Transaction No."
                value={
                  form.method === 'Cash'
                    ? 'Auto-generated after saving'
                    : form.referenceId
                }
                onChange={(value) => updateField('referenceId', value)}
                placeholder="Enter bank ref, OR no., transaction no."
                disabled={form.method === 'Cash'}
                helper={
                  form.method === 'Cash'
                    ? 'Cash payments will get a reference like CASH-YYYYMMDD-UNIT-0001.'
                    : 'Required for bank, online, GCash, check, and other payment methods.'
                }
              />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3 text-sm font-semibold text-slate-600">
              <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <p>
                Interest and penalty are computed automatically from the SOA. The
                payment form only records the actual collection.
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700"
          >
            Add Payment
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddSOAPaymentModal