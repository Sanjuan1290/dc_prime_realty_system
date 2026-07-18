import { useMemo, useState } from 'react'
import { FiAlertCircle, FiCreditCard, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import {
  cleanPaymentNumber,
  formatPaymentAmountInput,
  getFullPaymentAmount,
  getRowTotalDue,
  getRowUnpaidAmount,
} from './paymentAmountUtils'

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
      const totalDue = getRowTotalDue(row)

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

const getRowMatchesPaymentType = (row = {}, paymentType = '') => {
  const type = normalizePaymentType(paymentType)
  const rowType = getPaymentTypeFromDescription(row.description)
  const text = String(row.description || '').toLowerCase()

  if (type === 'Advance Payment') return rowType === 'Monthly'
  if (type === 'Other') return rowType === 'Other' || text.includes('legal') || text.includes('misc') || text.includes('lmf')
  return rowType === type
}

const getSuggestedRowForPaymentType = (rows = [], paymentType = '') => {
  const matchingRows = rows.filter((row) => getRowMatchesPaymentType(row, paymentType))

  return (
    matchingRows.find((row) => {
      const status = String(row.status || '').toLowerCase()
      return ['unpaid', 'partial', 'overdue'].includes(status) && getRowUnpaidAmount(row) > 0
    }) ||
    matchingRows.find((row) => getRowUnpaidAmount(row) > 0) ||
    matchingRows[0] ||
    getSuggestedRow(rows)
  )
}

const normalizePaymentType = (value = '') => {
  const clean = String(value || '').trim()
  return paymentTypes.includes(clean) ? clean : 'Other'
}

const formatDate = (value) => {
  if (!value || value === '-') return todayISO()
  return String(value).slice(0, 10)
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

const AddSOAPaymentModal = ({
  listing = {},
  rows = [],
  initialPayment = null,
  mode = 'add',
  isSaving = false,
  onClose,
  onSave,
}) => {
  const isEdit = Boolean(mode === 'edit' && initialPayment)
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
        getRowTotalDue(suggestedRow)
    ),
    paymentDate: formatDate(initialPayment?.paymentDate),
    method: initialPayment?.method || 'Cash',
    referenceId:
      initialPayment?.referenceId && initialPayment?.referenceId !== '-'
        ? initialPayment.referenceId
        : '',
  })
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(Boolean(isEdit && initialPayment?.amount))

  const isBalloonPayment = form.paymentType === 'Balloon'
  const isFullPayment = form.paymentType === 'Full Payment'
  const requiresSoaRow = !isBalloonPayment && !isFullPayment

  const selectedRow = useMemo(
    () => rows.find((row) => String(row.id) === String(form.soaRowId)),
    [rows, form.soaRowId]
  )

  const fullPaymentAmount = useMemo(
    () => getFullPaymentAmount(rows, isEdit ? initialPayment?.amount : 0),
    [rows, isEdit, initialPayment?.amount]
  )

  const suggestedAmount = useMemo(() => {
    if (isFullPayment) return fullPaymentAmount
    if (isBalloonPayment || !selectedRow) return 0
    return getRowUnpaidAmount(selectedRow)
  }, [fullPaymentAmount, isBalloonPayment, isFullPayment, selectedRow])

  const automaticInterest = isFullPayment
    ? rows.reduce(
        (sum, row) =>
          sum + Math.max(Number(row.interest || 0) - Number(row.paidInterestAmount || 0), 0),
        0
      )
    : Number(selectedRow?.interest || 0)
  const automaticPenalty = isFullPayment
    ? rows.reduce(
        (sum, row) =>
          sum + Math.max(Number(row.penalty || 0) - Number(row.paidPenaltyAmount || 0), 0),
        0
      )
    : Number(selectedRow?.penalty || 0)

  // Full Payment uses a derived amount so refreshed SOA rows are reflected
  // immediately without copying server data into another state value.
  const displayedAmount = isFullPayment
    ? formatPaymentAmountInput(fullPaymentAmount)
    : form.amount

  const updateField = (key, value) => {
    if (key === 'amount' && isFullPayment) return

    const shouldPreserveManualAmount = amountManuallyEdited || isEdit

    if (key === 'amount') {
      setAmountManuallyEdited(true)
    }

    if (key === 'paymentType' && normalizePaymentType(value) === 'Full Payment') {
      setAmountManuallyEdited(false)
    }

    setForm((current) => {
      const next = { ...current, [key]: value }

      if (key === 'method' && value === 'Cash') {
        next.referenceId = isEdit && current.method === 'Cash' ? current.referenceId : ''
      }

      if (key === 'paymentType') {
        const nextType = normalizePaymentType(value)

        if (nextType === 'Balloon') {
          next.soaRowId = ''
        } else if (nextType === 'Full Payment') {
          next.soaRowId = ''
          next.amount = formatPaymentAmountInput(fullPaymentAmount)
        } else {
          const nextRow = getSuggestedRowForPaymentType(rows, nextType)

          if (nextRow) {
            next.soaRowId = String(nextRow.id || '')

            if (!shouldPreserveManualAmount) {
              next.amount = formatPaymentAmountInput(getRowUnpaidAmount(nextRow))
            }
          }
        }
      }

      if (key === 'soaRowId') {
        const nextRow = rows.find((row) => String(row.id) === String(value))

        if (nextRow && next.paymentType !== 'Balloon' && next.paymentType !== 'Full Payment') {
          next.paymentType = getPaymentTypeFromDescription(nextRow.description)

          if (!shouldPreserveManualAmount) {
            next.amount = formatPaymentAmountInput(getRowUnpaidAmount(nextRow))
          }
        }
      }

      return next
    })

    if (alert?.type === 'error') setAlert(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const paymentAmount = isFullPayment
      ? fullPaymentAmount
      : cleanPaymentNumber(form.amount)

    if (requiresSoaRow && !form.soaRowId) {
      setAlert({ type: 'error', message: 'Select an SOA row for this payment.' })
      return
    }

    if (paymentAmount <= 0) {
      setAlert({ type: 'error', message: 'Payment amount is required.' })
      return
    }

    if (isFullPayment && Math.abs(paymentAmount - fullPaymentAmount) > 0.009) {
      setAlert({
        type: 'error',
        message: `Full Payment must equal the current unpaid SOA total of ${money(fullPaymentAmount)}.`,
      })
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
        soaRowId: isBalloonPayment || isFullPayment ? null : form.soaRowId,
        paymentType:
          form.paymentType === 'Other' && selectedRow && /legal|misc|lmf/i.test(String(selectedRow.description || ''))
            ? 'legal_misc'
            : form.paymentType,
        amount: paymentAmount,
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
                ) : isFullPayment ? (
                  <p className="mt-1 text-xs font-semibold text-blue-700">
                    Full Payment covers every unpaid SOA row. The Amount field is locked to{' '}
                    <span className="font-black">{money(fullPaymentAmount)}</span>.
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
              <p className="text-xs font-black uppercase text-slate-500">{isFullPayment ? 'Full Remaining Amount' : 'Due Amount'}</p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {money(isFullPayment ? fullPaymentAmount : getRowTotalDue(selectedRow))}
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
            {isBalloonPayment || isFullPayment ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-black text-slate-700">Apply To SOA Row</span>
                <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-600">
                  {isFullPayment
                    ? 'Not required. Full Payment is applied across every unpaid SOA row.'
                    : 'Not required. Balloon payments go directly to principal.'}
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  {isFullPayment
                    ? 'The system starts with the oldest unpaid row and continues until the account balance is cleared.'
                    : 'This will reduce the principal balance and shorten the remaining monthly schedule.'}
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
                    {row.description} · Due {row.dueDate} · {money(getRowTotalDue(row))}
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
              value={displayedAmount}
              onChange={(value) => updateField('amount', value)}
              placeholder="0.00"
              helper={
                isFullPayment
                  ? `Auto-filled from the complete unpaid SOA balance: ${money(fullPaymentAmount)}.`
                  : isBalloonPayment
                    ? 'Balloon amount will be deducted from principal, not from a scheduled monthly row.'
                    : `Suggested unpaid amount: ${money(suggestedAmount)}`
              }
              disabled={isFullPayment}
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
