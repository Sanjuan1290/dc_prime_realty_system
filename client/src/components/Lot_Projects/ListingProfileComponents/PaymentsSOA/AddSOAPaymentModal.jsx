import { useEffect, useMemo, useRef, useState } from 'react'
import { FiCreditCard, FiX } from 'react-icons/fi'
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

const todayISO = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())


const createPaymentRequestKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replaceAll('-', '')
  }

  return `payment_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`
}

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
  canWaivePenalty = false,
  onPreview,
  onClose,
  onSave,
}) => {
  const isEdit = Boolean(mode === 'edit' && initialPayment)
  const submitLockRef = useRef(false)
  const previewRequestRef = useRef(0)
  const requestKeyRef = useRef(isEdit ? null : createPaymentRequestKey())
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
    bankName:
      initialPayment?.bankName ||
      initialPayment?.bank_name ||
      initialPayment?.paymentBank ||
      '',
    accountNumber:
      initialPayment?.accountNumber ||
      initialPayment?.account_number ||
      initialPayment?.accountNo ||
      '',
    referenceId:
      initialPayment?.referenceId && initialPayment?.referenceId !== '-'
        ? initialPayment.referenceId
        : '',
  })
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(Boolean(isEdit && initialPayment?.amount))
  const [paymentPreview, setPaymentPreview] = useState(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const linkedPenaltyWaiver = initialPayment?.penaltyWaiver || null
  const [penaltyHandling, setPenaltyHandling] = useState(linkedPenaltyWaiver && !['cancelled', 'restored'].includes(String(linkedPenaltyWaiver.status || '').toLowerCase()) ? 'waive' : 'apply')
  const [penaltyWaiverReason, setPenaltyWaiverReason] = useState(linkedPenaltyWaiver?.reason || '')
  const [penaltyWaiverInternalNotes, setPenaltyWaiverInternalNotes] = useState(linkedPenaltyWaiver?.internalNotes || '')

  const isBalloonPayment = form.paymentType === 'Balloon'
  const isFullPayment = form.paymentType === 'Full Payment'
  const requiresSoaRow = !isBalloonPayment && !isFullPayment

  const selectedRow = useMemo(
    () => rows.find((row) => String(row.id) === String(form.soaRowId)),
    [rows, form.soaRowId]
  )

  useEffect(() => {
    if (typeof onPreview !== 'function' || !form.paymentDate || (requiresSoaRow && !form.soaRowId)) {
      setPaymentPreview(null)
      setPreviewError('')
      setIsPreviewLoading(false)
      return undefined
    }

    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    let cancelled = false

    const timer = window.setTimeout(async () => {
      setIsPreviewLoading(true)
      setPreviewError('')

      try {
        const result = await onPreview({
          soaRowId: requiresSoaRow ? form.soaRowId : null,
          paymentType: form.paymentType,
          paymentDate: form.paymentDate,
          excludePaymentId: isEdit ? Number(initialPayment?.paymentId || initialPayment?.id || 0) : 0,
        })

        if (cancelled || previewRequestRef.current !== requestId) return
        setPaymentPreview(result || null)

        const previewPenalty = Number(result?.selectedRow?.penaltyOutstanding || 0)
        const previewAmount = form.paymentType === 'Full Payment'
          ? Number(result?.fullPaymentAmount || 0)
          : form.paymentType === 'Balloon'
            ? 0
            : Math.max(Number(result?.selectedRow?.totalPayable || 0) - (penaltyHandling === 'waive' && canWaivePenalty ? previewPenalty : 0), 0)

        if (previewAmount > 0 && (form.paymentType === 'Full Payment' || (!amountManuallyEdited && !isEdit))) {
          setForm((current) => ({
            ...current,
            amount: formatPaymentAmountInput(previewAmount),
          }))
        }
      } catch (error) {
        if (cancelled || previewRequestRef.current !== requestId) return
        setPaymentPreview(null)
        setPreviewError(error?.message || 'Could not calculate the payment amount for this date.')
      } finally {
        if (!cancelled && previewRequestRef.current === requestId) setIsPreviewLoading(false)
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    amountManuallyEdited,
    form.paymentDate,
    form.paymentType,
    form.soaRowId,
    initialPayment,
    isEdit,
    onPreview,
    penaltyHandling,
    canWaivePenalty,
    requiresSoaRow,
  ])

  const fallbackFullPaymentAmount = useMemo(
    () => getFullPaymentAmount(rows, isEdit ? initialPayment?.amount : 0),
    [rows, isEdit, initialPayment?.amount]
  )

  const fallbackBalloonPrincipalCapacity = useMemo(() => {
    const remainingMonthlyPrincipal = rows.reduce((sum, row) => {
      const description = String(row.description || '').toLowerCase()
      const status = String(row.status || '').toLowerCase()
      if (!description.includes('monthly') || status === 'cancelled') return sum

      const principal = Number(row.principalAmount || row.principal_amount || 0)
      const principalPaid = Number(row.paidPrincipalAmount || row.paid_principal_amount || 0)
      return sum + Math.max(principal - principalPaid, 0)
    }, 0)

    const editingBalloonAmount = isEdit && normalizePaymentType(
      initialPayment?.paymentType || initialPayment?.type
    ) === 'Balloon'
      ? Number(initialPayment?.amount || 0)
      : 0

    return Math.max(remainingMonthlyPrincipal + editingBalloonAmount, 0)
  }, [initialPayment, isEdit, rows])

  const fullPaymentAmount = Number(paymentPreview?.fullPaymentAmount || fallbackFullPaymentAmount || 0)
  const balloonPrincipalCapacity = Number(paymentPreview?.balloonPrincipalCapacity || fallbackBalloonPrincipalCapacity || 0)
  const previewRow = paymentPreview?.selectedRow || null
  const fullSummary = paymentPreview?.fullSummary || null

  const suggestedAmount = useMemo(() => {
    if (isFullPayment) return fullPaymentAmount
    if (isBalloonPayment) return 0
    if (previewRow) return Number(previewRow.totalPayable || 0)
    if (!selectedRow) return 0
    return getRowUnpaidAmount(selectedRow)
  }, [fullPaymentAmount, isBalloonPayment, isFullPayment, previewRow, selectedRow])

  const baseOutstanding = isFullPayment
    ? Number(fullSummary?.principalOutstanding || Math.max(fullPaymentAmount - Number(fullSummary?.interestOutstanding || 0) - Number(fullSummary?.penaltyOutstanding || 0), 0))
    : isBalloonPayment
      ? balloonPrincipalCapacity
      : Number(previewRow?.principalOutstanding ?? Math.max(Number(selectedRow?.dueAmount || 0) - Number(selectedRow?.discountAmount || 0) - Number(selectedRow?.interest || 0), 0))

  const automaticInterest = isFullPayment
    ? Number(fullSummary?.interestOutstanding || 0)
    : isBalloonPayment
      ? 0
      : Number(previewRow?.interestOutstanding ?? selectedRow?.interest ?? 0)

  const automaticPenalty = isFullPayment
    ? Number(fullSummary?.penaltyOutstanding || 0)
    : isBalloonPayment
      ? 0
      : Number(previewRow?.penaltyOutstanding ?? selectedRow?.outstandingPenaltyAmount ?? selectedRow?.penalty ?? 0)

  const totalPayable = isFullPayment
    ? fullPaymentAmount
    : isBalloonPayment
      ? balloonPrincipalCapacity
      : Number(previewRow?.totalPayable || suggestedAmount || 0)

  const canOfferPenaltyWaiver = Boolean(canWaivePenalty && requiresSoaRow && automaticPenalty > 0.009)
  const isPenaltyWaivedForPayment = canOfferPenaltyWaiver && penaltyHandling === 'waive'
  const adjustedSuggestedAmount = isPenaltyWaivedForPayment ? Math.max(suggestedAmount - automaticPenalty, 0) : suggestedAmount
  const payableAfterPenaltyHandling = isPenaltyWaivedForPayment ? Math.max(totalPayable - automaticPenalty, 0) : totalPayable

  useEffect(() => {
    if (!canOfferPenaltyWaiver && penaltyHandling === 'waive') setPenaltyHandling('apply')
  }, [canOfferPenaltyWaiver, penaltyHandling])

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
        next.bankName = ''
        next.accountNumber = ''
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
    if (submitLockRef.current || isSaving || alert?.type === 'loading') return

    if (typeof onPreview === 'function' && isPreviewLoading) {
      setAlert({ type: 'error', message: 'Wait for the payment-date calculation to finish.' })
      return
    }

    if (typeof onPreview === 'function' && previewError) {
      setAlert({ type: 'error', message: previewError })
      return
    }

    if (typeof onPreview === 'function' && !paymentPreview) {
      setAlert({ type: 'error', message: 'Payment-date calculation is required before saving.' })
      return
    }

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

    if (isBalloonPayment && paymentAmount - balloonPrincipalCapacity > 0.009) {
      setAlert({
        type: 'error',
        message: `Balloon Payment cannot exceed the remaining financed principal of ${money(balloonPrincipalCapacity)}.`,
      })
      return
    }

    if (form.paymentDate > todayISO()) {
      setAlert({ type: 'error', message: 'Future payment dates are blocked.' })
      return
    }

    if (penaltyHandling === 'waive') {
      if (!canOfferPenaltyWaiver) {
        setAlert({ type: 'error', message: 'There is no calculated penalty available to waive for this payment.' })
        return
      }
      if (!penaltyWaiverReason.trim()) {
        setAlert({ type: 'error', message: 'Reason is required when waiving the penalty for this payment.' })
        return
      }
    }

    if (form.method !== 'Cash' && !form.bankName.trim()) {
      setAlert({
        type: 'error',
        message: 'Bank / payment provider is required for non-cash payments.',
      })
      return
    }

    if (form.method !== 'Cash' && !form.accountNumber.trim()) {
      setAlert({
        type: 'error',
        message: 'Account No. / wallet number is required for non-cash payments.',
      })
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
      submitLockRef.current = true
      setAlert({ type: 'loading', message: 'Preparing payment review...' })

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
        bankName: form.method === 'Cash' ? null : form.bankName.trim(),
        accountNumber: form.method === 'Cash' ? null : form.accountNumber.trim(),
        referenceId: form.method === 'Cash' ? form.referenceId : form.referenceId.trim(),
        penaltyHandling: isPenaltyWaivedForPayment ? 'waive' : 'apply',
        penaltyPreviewAmount: isPenaltyWaivedForPayment ? automaticPenalty : 0,
        penaltyWaiverReason: isPenaltyWaivedForPayment ? penaltyWaiverReason.trim() : '',
        penaltyWaiverInternalNotes: isPenaltyWaivedForPayment ? penaltyWaiverInternalNotes.trim() : '',
        requestKey: isEdit ? undefined : requestKeyRef.current,
      })
    } catch (error) {
      submitLockRef.current = false
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

          {isPreviewLoading ? (
            <p className="mb-4 text-xs font-black text-blue-600">Calculating the amount as of {form.paymentDate}...</p>
          ) : previewError ? (
            <StatusAlert type="error" message={previewError} className="mb-4" />
          ) : null}

          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">
                {isFullPayment ? 'Base Outstanding' : isBalloonPayment ? 'Available Monthly Principal' : 'Base Outstanding'}
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">{money(baseOutstanding)}</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase text-amber-700">Interest</p>
              <p className="mt-1 text-lg font-black text-amber-900">{money(automaticInterest)}</p>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-black uppercase text-red-700">Penalty</p>
              <p className="mt-1 text-lg font-black text-red-900">{money(automaticPenalty)}</p>
              {!isFullPayment && !isBalloonPayment && previewRow ? <p className="mt-1 text-[11px] font-bold text-red-700">As of {paymentPreview?.paymentDate || form.paymentDate} · {Number(previewRow.penaltyDays || 0)} penalty day(s)</p> : null}
              {isPenaltyWaivedForPayment ? <p className="mt-1 text-[11px] font-black text-emerald-700">Waived for this payment · Penalty due {money(0)}</p> : null}
            </div>

            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-black uppercase text-violet-700">Total Payable</p>
              <p className="mt-1 text-lg font-black text-violet-900">{money(payableAfterPenaltyHandling)}</p>
              {isPenaltyWaivedForPayment ? <p className="mt-1 text-[11px] font-bold text-violet-700">Calculated penalty removed from this payment.</p> : null}
            </div>
          </div>

          {canOfferPenaltyWaiver ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-black text-emerald-950">Penalty Handling</p>
              <p className="mt-1 text-xs font-semibold text-emerald-800">The selected payment date creates {money(automaticPenalty)} in penalty. Choose whether to collect it or formally waive it for this payment.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${penaltyHandling === 'apply' ? 'border-red-300 bg-white' : 'border-emerald-200 bg-emerald-50/40'}`}>
                  <input type="radio" name="penaltyHandling" value="apply" checked={penaltyHandling === 'apply'} onChange={() => { setPenaltyHandling('apply'); if (alert?.type === 'error') setAlert(null) }} disabled={isSaving} className="mt-1" />
                  <span><span className="block text-sm font-black text-slate-900">Apply calculated penalty</span><span className="mt-1 block text-xs font-semibold text-slate-500">Buyer owes {money(automaticPenalty)} penalty.</span></span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${penaltyHandling === 'waive' ? 'border-emerald-400 bg-white' : 'border-emerald-200 bg-emerald-50/40'}`}>
                  <input type="radio" name="penaltyHandling" value="waive" checked={penaltyHandling === 'waive'} onChange={() => { setPenaltyHandling('waive'); if (alert?.type === 'error') setAlert(null) }} disabled={isSaving} className="mt-1" />
                  <span><span className="block text-sm font-black text-slate-900">Waive penalty for this payment</span><span className="mt-1 block text-xs font-semibold text-slate-500">Keep the real payment date, but save the {money(automaticPenalty)} penalty as formally waived.</span></span>
                </label>
              </div>
              {penaltyHandling === 'waive' ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-emerald-950">Waiver Reason *</span><input value={penaltyWaiverReason} onChange={(event) => { setPenaltyWaiverReason(event.target.value); if (alert?.type === 'error') setAlert(null) }} placeholder="Example: Historical payment — penalty was not applicable at the time." disabled={isSaving} className="h-11 rounded-xl border border-emerald-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /></label>
                  <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-emerald-950">Internal Notes</span><input value={penaltyWaiverInternalNotes} onChange={(event) => setPenaltyWaiverInternalNotes(event.target.value)} placeholder="Optional internal note" disabled={isSaving} className="h-11 rounded-xl border border-emerald-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /></label>
                </div>
              ) : null}
            </div>
          ) : null}

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
                    ? `Direct principal reduction. Maximum available: ${money(balloonPrincipalCapacity)}. The regular monthly amount stays the same while the final monthly rows are removed.`
                    : `Suggested amount as of ${form.paymentDate}: ${money(adjustedSuggestedAmount)}${isPenaltyWaivedForPayment ? ' after penalty waiver' : ''}`
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
              helper="Penalty and outstanding balance are recalculated using this payment date. Future dates are blocked."
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

            {form.method !== 'Cash' ? (
              <>
                <Field
                  label="Bank / Payment Provider"
                  value={form.bankName}
                  onChange={(value) => updateField('bankName', value)}
                  placeholder="Example: BPI, BDO, GCash, Maya"
                  helper="This appears under BANK on the acknowledgement receipt."
                  required
                />

                <Field
                  label="Account No. / Wallet No."
                  value={form.accountNumber}
                  onChange={(value) => updateField('accountNumber', value)}
                  placeholder="Enter the receiving account or wallet number"
                  helper="Saved as text to preserve leading zeroes and printed on the acknowledgement receipt."
                  required
                />
              </>
            ) : null}

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
                  ? 'Cash payments use the payment record ID, for example CASH-YYYYMMDD-UNIT-P60001.'
                  : 'Required for bank, online, check, and other payment methods.'
              }
            />
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
            disabled={isSaving || isPreviewLoading || alert?.type === 'loading'}
            className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSaving || alert?.type === 'loading'
              ? isEdit
                ? 'Opening Review...'
                : 'Opening Review...'
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

