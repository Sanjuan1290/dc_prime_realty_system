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

const paymentTypes = [
  'Reservation',
  'Downpayment',
  'Monthly',
  'Advance Payment',
  'Balloon',
  'Full Payment',
  'Other',
]

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

      return ['unpaid', 'partial', 'overdue'].includes(status) && amountPaid < totalDue
    }) || rows[0]
  )
}

const getPaymentTypeFromDescription = (description = '') => {
  const text = String(description || '').toLowerCase()

  if (text.includes('reservation')) return 'Reservation'
  if (text.includes('downpayment') || text.includes('down payment')) return 'Downpayment'
  if (text.includes('advance')) return 'Advance Payment'
  if (text.includes('balloon')) return 'Balloon'
  if (text.includes('full')) return 'Full Payment'
  if (text.includes('legal') || text.includes('misc') || text.includes('lmf')) return 'Other'
  return 'Monthly'
}

const normalizePaymentType = (value = '') => {
  const clean = String(value || '').trim()
  return paymentTypes.includes(clean) ? clean : 'Other'
}

const formatDate = (value) => {
  if (!value || value === '-') return todayISO()
  return String(value).slice(0, 10)
}

const cleanNumber = (value) => Number(String(value || '').replace(/[^0-9.-]/g, '')) || 0

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

const AddSOAPaymentModal = ({
  listing = {},
  rows = [],
  initialPayment = null,
  mode = 'add',
  isSaving = false,
  onClose,
  onSave,
}) => {
  const isEdit = mode === 'edit' && initialPayment
  const suggestedRow = isEdit
    ? rows.find((row) => String(row.id) === String(initialPayment.soaRowId)) || getSuggestedRow(rows)
    : getSuggestedRow(rows)

  const unitCode = getListingValue(listing, ['unit_id', 'unitCode', 'unitNo'], 'Unit')
  const buyerName = getListingValue(listing, ['buyer_name', 'buyerName', 'clientName'], 'Client')
  const projectName = getListingValue(listing, ['project_name', 'projectName'], 'Project')

  const [alert, setAlert] = useState(null)
  const [form, setForm] = useState({
    soaRowId: String(initialPayment?.soaRowId || suggestedRow?.id || ''),
    paymentType: normalizePaymentType(
      initialPayment?.paymentType || initialPayment?.type || getPaymentTypeFromDescription(suggestedRow?.description)
    ),
    amount: String(
      initialPayment?.amount ||
        Number(suggestedRow?.dueAmount || 0) +
          Number(suggestedRow?.interest || 0) +
          Number(suggestedRow?.penalty || 0)
    ),
    paymentDate: formatDate(initialPayment?.paymentDate),
    method: initialPayment?.method || 'Cash',
    referenceId:
      initialPayment?.referenceId && initialPayment?.referenceId !== '-'
        ? initialPayment.referenceId
        : '',
  })

  const isBalloonPayment = form.paymentType === 'Balloon'

  const selectedRow = useMemo(
    () => rows.find((row) => String(row.id) === String(form.soaRowId)),
    [rows, form.soaRowId]
  )

  const suggestedAmount = useMemo(() => {
    if (isBalloonPayment || !selectedRow) return 0

    return (
      Number(selectedRow.dueAmount || 0) +
      Number(selectedRow.interest || 0) +
      Number(selectedRow.penalty || 0) -
      Number(selectedRow.amountPaid || 0)
    )
  }, [isBalloonPayment, selectedRow])

  const automaticInterest = Number(selectedRow?.interest || 0)
  const automaticPenalty = Number(selectedRow?.penalty || 0)

  const updateField = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value }

      if (key === 'method' && value === 'Cash') {
        next.referenceId = isEdit && current.method === 'Cash' ? current.referenceId : ''
      }

      if (key === 'paymentType') {
        if (value === 'Balloon') {
          next.soaRowId = ''
        } else if (!next.soaRowId && suggestedRow) {
          next.soaRowId = String(suggestedRow.id || '')
          if (!isEdit) {
            next.amount = String(
              Math.max(
                Number(suggestedRow.dueAmount || 0) +
                  Number(suggestedRow.interest || 0) +
                  Number(suggestedRow.penalty || 0) -
                  Number(suggestedRow.amountPaid || 0),
                0
              )
            )
          }
        }
      }

      if (key === 'soaRowId') {
        const nextRow = rows.find((row) => String(row.id) === String(value))
        if (!isEdit && nextRow && next.paymentType !== 'Balloon') {
          next.paymentType = getPaymentTypeFromDescription(nextRow.description)
          next.amount = String(
            Math.max(
              Number(nextRow.dueAmount || 0) +
                Number(nextRow.interest || 0) +
                Number(nextRow.penalty || 0) -
                Number(nextRow.amountPaid || 0),
              0
            )
          )
        }
      }

      return next
    })

    if (alert?.type === 'error') setAlert(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!isBalloonPayment && !form.soaRowId) {
      setAlert({ type: 'error', message: 'Select an SOA row for this payment.' })
      return
    }

    if (!form.amount || cleanNumber(form.amount) <= 0) {
      setAlert({ type: 'error', message: 'Payment amount is required.' })
      return
    }

    if (form.paymentDate > todayISO()) {
      setAlert({ type: 'error', message: 'Future payment dates are blocked.' })
      return
    }

    if (form.method !== 'Cash' && !form.referenceId.trim()) {
      setAlert({
        type: 'error',
        message: 'Reference ID / OR No. / Transaction No. is required for non-cash payments.',
      })
      return
    }

    try {
      setAlert({ type: 'loading', message: isEdit ? 'Updating payment...' : 'Saving payment...' })

      await onSave({
        paymentId: initialPayment?.paymentId || initialPayment?.id,
        soaRowId: isBalloonPayment ? null : form.soaRowId,
        paymentType:
          form.paymentType === 'Other' && selectedRow && /legal|misc|lmf/i.test(String(selectedRow.description || ''))
            ? 'legal_misc'
            : form.paymentType,
        amount: cleanNumber(form.amount),
        paymentDate: form.paymentDate,
        method: form.method,
        referenceId: form.method === 'Cash' ? form.referenceId : form.referenceId.trim(),
      })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to save payment.' })
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              {isEdit ? 'Edit Payment' : 'Add Payment'}
            </h2>
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

                {isBalloonPayment ? (
                  <p className="mt-1 text-xs font-semibold text-blue-700">
                    Balloon payment applies directly to principal and shortens the remaining monthly rows.
                  </p>
                ) : selectedRow ? (
                  <p className="mt-1 text-xs font-semibold text-blue-700">
                    Payment applies to{' '}
                    <span className="font-black">{selectedRow.description}</span> ·{' '}
                    Suggested unpaid amount: {money(suggestedAmount)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-semibold text-red-700">
                    No SOA row available.
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
              <p className="text-xs font-black uppercase text-amber-700">Interest</p>
              <p className="mt-1 text-lg font-black text-amber-900">
                {money(automaticInterest)}
              </p>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-black uppercase text-red-700">Penalty</p>
              <p className="mt-1 text-lg font-black text-red-900">
                {money(automaticPenalty)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {isBalloonPayment ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-black text-slate-700">Apply To SOA Row</span>
                <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-600">
                  Not required. Balloon payments go directly to principal.
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  This will reduce the principal balance and shorten the remaining monthly schedule.
                </p>
              </div>
            ) : (
              <SelectField
                label="Apply To SOA Row"
                value={form.soaRowId}
                onChange={(value) => updateField('soaRowId', value)}
                required
              >
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.description} · Due {row.dueDate} · {money(row.dueAmount)}
                  </option>
                ))}
              </SelectField>
            )}

            <SelectField
              label="Payment Type"
              value={form.paymentType}
              onChange={(value) => updateField('paymentType', value)}
              required
            >
              {paymentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </SelectField>

            <Field
              label="Amount"
              type="number"
              value={form.amount}
              onChange={(value) => updateField('amount', value)}
              placeholder="0.00"
              helper={
                isBalloonPayment
                  ? 'Balloon amount will be deducted from principal, not from a scheduled monthly row.'
                  : `Suggested unpaid amount: ${money(suggestedAmount)}`
              }
              required
            />

            <Field
              label="Payment Date"
              type="date"
              value={form.paymentDate}
              max={todayISO()}
              onChange={(value) => updateField('paymentDate', value)}
              helper="Future dates are blocked."
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
              <option value="Online Payment">Online Payment</option>
              <option value="Check">Check</option>
              <option value="Other">Other</option>
            </SelectField>

            <Field
              label="Reference ID / OR No. / Transaction No."
              value={
                form.method === 'Cash' && !isEdit
                  ? 'Auto-generated after saving'
                  : form.referenceId
              }
              onChange={(value) => updateField('referenceId', value)}
              placeholder="Enter bank ref, OR no., transaction no."
              disabled={form.method === 'Cash'}
              helper={
                form.method === 'Cash'
                  ? 'Cash payments will get a reference like CASH-YYYYMMDD-UNIT-0001.'
                  : 'Required for bank, online, check, and other payment methods.'
              }
            />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3 text-sm font-semibold text-slate-600">
              <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <p>
                Payment status is removed here because admin-added payments are saved as verified automatically.
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
            disabled={isSaving || alert?.type === 'loading'}
            className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSaving || alert?.type === 'loading'
              ? isEdit
                ? 'Updating...'
                : 'Saving...'
              : isEdit
                ? 'Save Changes'
                : 'Add Payment'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddSOAPaymentModal

