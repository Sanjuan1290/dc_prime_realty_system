import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiEdit2,
  FiPlus,
  FiSettings,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetchPost, useFetchPut } from '../../../../utils/useFetch'
import useCurrentUser from '../../../../utils/useCurrentUser'
import AddSOAPaymentModal from './AddSOAPaymentModal'
import PenaltyReliefModal from './PenaltyReliefModal'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const cleanMoney = (value) => {
  if (typeof value === 'number') return value
  return Number(String(value || '').replace(/[₱,\s]/g, '')) || 0
}

const formatDate = (value) => {
  if (!value || value === '-') return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)

  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

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

const normalizeRows = (rows = []) => {
  return rows.map((row, index) => ({
    id: row.id || row.scheduleId || row.lot_project_payment_schedule_id || index + 1,
    scheduleId: Number(row.scheduleId || row.lot_project_payment_schedule_id || row.id || 0),
    dueDate: row.dueDate || row.due_date || '',
    description: row.description || row.payment_description || '',
    scheduleType: row.scheduleType || row.schedule_type || '',
    beginningBalance: cleanMoney(row.beginningBalance ?? row.beginning_balance),
    dueAmount: cleanMoney(row.dueAmount ?? row.due_amount),
    monthlyAmortizationAmount: cleanMoney(row.monthlyAmortizationAmount ?? row.monthly_amortization_amount ?? row.dueAmount ?? row.due_amount),
    principalAmount: cleanMoney(row.principalAmount ?? row.principal_amount ?? row.dueAmount ?? row.due_amount),
    interest: cleanMoney(row.interest ?? row.interestAmount ?? row.interest_amount),
    discountAmount: cleanMoney(row.discountAmount ?? row.discount_amount),
    penalty: cleanMoney(row.penalty ?? row.penaltyAmount ?? row.penalty_amount),
    calculatedPenaltyAmount: cleanMoney(row.calculatedPenaltyAmount ?? row.calculated_penalty_amount ?? row.penalty ?? row.penalty_amount),
    waivedPenaltyAmount: cleanMoney(row.waivedPenaltyAmount ?? row.waived_penalty_amount),
    outstandingPenaltyAmount: cleanMoney(row.outstandingPenaltyAmount ?? row.outstanding_penalty_amount),
    penaltyRatePercent: Number(row.penaltyRatePercent ?? row.penalty_rate_percent ?? 0),
    penaltyGraceDays: Number(row.penaltyGraceDays ?? row.penalty_grace_days ?? 0),
    penaltyStartDate: row.penaltyStartDate || row.penalty_start_date || '',
    penaltyCalculatedThrough: row.penaltyCalculatedThrough || row.penalty_calculated_through || '',
    penaltyReliefs: row.penaltyReliefs || row.penalty_reliefs || [],
    activePenaltyExtension: row.activePenaltyExtension || row.active_penalty_extension || null,
    canGrantPenaltyExtension: Boolean(row.canGrantPenaltyExtension ?? row.can_grant_penalty_extension),
    canWaivePenalty: Boolean(row.canWaivePenalty ?? row.can_waive_penalty),
    datePaid: row.datePaid || row.date_paid || '',
    amountPaid: cleanMoney(row.amountPaid ?? row.amount_paid),
    paidPrincipalAmount: cleanMoney(row.paidPrincipalAmount ?? row.paid_principal_amount),
    paidInterestAmount: cleanMoney(row.paidInterestAmount ?? row.paid_interest_amount),
    paidPenaltyAmount: cleanMoney(row.paidPenaltyAmount ?? row.paid_penalty_amount),
    totalDue: cleanMoney(row.totalDue ?? row.total_due ?? row.dueAmount ?? row.due_amount),
    referenceId: row.referenceId || row.reference_id || row.reference || '-',
    paymentMethod: row.paymentMethod || row.payment_method || '-',
    verifiedBy: row.verifiedBy || row.verified_by || '-',
    status: row.status || row.schedule_status || 'Unpaid',
    endingBalance: cleanMoney(
      row.endingBalance ??
        row.remainingBalance ??
        row.runningBalance ??
        row.ending_balance
    ),
  }))
}

const normalizePayments = (payments = [], listing = {}) => {
  const buyerName = getListingValue(listing, ['buyer_name', 'buyerName', 'clientName'], '-')
  const unitCode = getListingValue(listing, ['unit_id', 'unitCode', 'unitNo'], '-')
  const projectName = getListingValue(listing, ['project_name', 'projectName'], '-')

  return payments.map((payment, index) => ({
    id: payment.id || payment.paymentId || index + 1,
    paymentId: payment.paymentId || payment.id,
    soaRowId: payment.soaRowId || payment.lot_project_payment_schedule_id || '',
    client: payment.client || buyerName,
    unit: payment.unit || unitCode,
    project: payment.project || projectName,
    type: payment.type || payment.paymentType || 'Other',
    paymentType: payment.paymentType || payment.type || 'Other',
    amount: cleanMoney(payment.amount ?? payment.lot_project_payment_amount),
    method: payment.method || payment.paymentMethod || payment.lot_project_payment_method || '-',
    bankName:
      payment.bankName ||
      payment.bank_name ||
      payment.lot_project_payment_bank_name ||
      '',
    accountNumber:
      payment.accountNumber ||
      payment.account_number ||
      payment.lot_project_payment_account_number ||
      '',
    referenceId:
      payment.referenceId ||
      payment.reference_id ||
      payment.lot_project_payment_reference_id ||
      '-',
    paymentDate:
      payment.paymentDate ||
      payment.payment_date ||
      payment.lot_project_payment_date ||
      '',
    verifiedBy: payment.verifiedBy || payment.verified_by || '-',
    verifiedAt: payment.verifiedAt || payment.verified_at || '',
    status: payment.status || payment.lot_project_payment_status || 'Verified',
    scheduleDescription: payment.scheduleDescription || payment.schedule_description || '-',
  }))
}

const paymentTypeOptions = [
  'Reservation',
  'Downpayment',
  'Monthly',
  'Advance Payment',
  'Balloon',
  'Full Payment',
  'Other',
]

const StatusPill = ({ status }) => {
  const normalized = String(status || '').toLowerCase()

  const styles = {
    paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    advance: 'border-blue-200 bg-blue-50 text-blue-700',
    verified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    partial: 'border-amber-200 bg-amber-50 text-amber-700',
    overdue: 'border-red-200 bg-red-50 text-red-700',
    unpaid: 'border-slate-200 bg-slate-100 text-slate-600',
    cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
  }

  const color = styles[normalized] || styles.unpaid

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${color}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || 'Unpaid'}
    </span>
  )
}

const SummaryCard = ({ label, value, tone = 'slate', isMoney = true }) => {
  const styles = {
    slate: 'bg-white text-slate-950',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }

  return (
    <div className={`rounded-2xl border border-slate-200 p-5 shadow-sm ${styles[tone]}`}>
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-black">
        {isMoney ? money(value) : value}
      </p>
    </div>
  )
}

const DeletePaymentModal = ({ payment, password, setPassword, alert, isDeleting, onClose, onConfirm }) => {
  if (!payment) return null

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-700">
              <FiAlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950">Delete Payment</h3>
              <p className="text-sm font-semibold text-slate-500">
                Super admin password is required.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {alert ? (
            <StatusAlert
              type={alert.type}
              message={alert.message}
              onClose={alert.type === 'loading' ? undefined : null}
              className="mb-4"
            />
          ) : null}

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            This will remove the payment record and reverse the amount applied to the SOA.
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="font-black text-slate-500">Reference ID</p>
                <p className="mt-1 font-semibold text-slate-900">{payment.referenceId}</p>
              </div>
              <div>
                <p className="font-black text-slate-500">Amount</p>
                <p className="mt-1 font-semibold text-slate-900">{money(payment.amount)}</p>
              </div>
              <div>
                <p className="font-black text-slate-500">Type</p>
                <p className="mt-1 font-semibold text-slate-900">{payment.type}</p>
              </div>
              <div>
                <p className="font-black text-slate-500">Date</p>
                <p className="mt-1 font-semibold text-slate-900">{formatDate(payment.paymentDate)}</p>
              </div>
            </div>
          </div>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-black text-slate-700">
              Super Admin Password <span className="text-red-500">*</span>
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter super admin password"
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-red-400 focus:ring-4 focus:ring-red-50"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {isDeleting ? 'Deleting...' : 'Delete Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}


const dailyPenaltyRateOptions = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 3, 4, 5]
const todayManila = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())
const penaltyGraceDayOptions = Array.from({ length: 32 }, (_, index) => index)

const SoaTermsModal = ({ listing = {}, isSaving = false, serverAlert, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({
    dpDiscountPercentage: String(getListingValue(listing, ['soaDpDiscountPercentage'], 0)),
    downpaymentPercentage: String(getListingValue(listing, ['soaDownpaymentPercentage'], 30)),
    downpaymentTerms: String(getListingValue(listing, ['soaDownpaymentTerms'], 3)),
    reservationFeeTreatment: getListingValue(listing, ['reservationFeeTreatment'], '') ||
      (getListingValue(listing, ['soaReservationFeeAppliedToDownpayment'], false) ? 'apply_to_downpayment' : 'separate'),
    monthlyTerms: String(getListingValue(listing, ['soaMonthlyTerms'], 36)),
    firstDueDate: getListingValue(listing, ['soaFirstDueDate', 'first_due_date'], ''),
    dailyPenaltyRate: String(getListingValue(listing, ['soaPenaltyRatePercent'], 0.1)),
    penaltyGraceDays: String(getListingValue(listing, ['soaPenaltyGraceDays'], 1)),
  }))
  const [modalAlert, setModalAlert] = useState({
    type: 'info',
    message: 'Payment schedule fields lock after a payment is recorded. Daily penalty rate and grace period stay editable.',
  })

  useEffect(() => {
    if (serverAlert?.type === 'error') {
      setModalAlert(serverAlert)
    }
  }, [serverAlert])

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (modalAlert?.type === 'error') setModalAlert(null)
  }

  const listingStartingDate = String(getListingValue(listing, ['soaStartingDate', 'starting_date'], '') || '')
  const firstDueMinimum = listingStartingDate && listingStartingDate > todayManila()
    ? listingStartingDate
    : todayManila()

  const submit = (event) => {
    event.preventDefault()

    const dpDiscountPercentage = Number(form.dpDiscountPercentage || 0)
    const downpaymentPercentage = Number(form.downpaymentPercentage || 0)
    const downpaymentTerms = Number(form.downpaymentTerms || 0)
    const monthlyTerms = Number(form.monthlyTerms || 0)
    const dailyPenaltyRate = Number(form.dailyPenaltyRate || 0)
    const penaltyGraceDays = Number(form.penaltyGraceDays || 0)
    if (dpDiscountPercentage < 0 || dpDiscountPercentage > 100) {
      setModalAlert({ type: 'error', message: 'DP Discount % must be between 0 and 100.' })
      return
    }

    if (downpaymentPercentage < 0 || downpaymentPercentage > 100) {
      setModalAlert({ type: 'error', message: 'Downpayment % must be between 0 and 100.' })
      return
    }

    if (!Number.isInteger(downpaymentTerms) || downpaymentTerms < 0) {
      setModalAlert({ type: 'error', message: 'Downpayment terms must be zero or greater.' })
      return
    }

    if (!Number.isInteger(monthlyTerms) || monthlyTerms < 1) {
      setModalAlert({ type: 'error', message: 'Monthly terms must be at least 1.' })
      return
    }

    if (!hasRecordedPayments) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.firstDueDate) || form.firstDueDate < todayManila()) {
        setModalAlert({ type: 'error', message: 'First Due Date must be today or a future date.' })
        return
      }
      if (listingStartingDate && form.firstDueDate < listingStartingDate) {
        setModalAlert({ type: 'error', message: 'First Due Date cannot be before the Starting Date.' })
        return
      }
    }

    const dailyPenaltyRateRaw = String(form.dailyPenaltyRate ?? '').trim()
    if (dailyPenaltyRateRaw === '' || !Number.isFinite(dailyPenaltyRate) || dailyPenaltyRate < 0 || dailyPenaltyRate > 100) {
      setModalAlert({ type: 'error', message: 'Daily penalty rate must be between 0 and 100.' })
      return
    }

    if (!penaltyGraceDayOptions.includes(penaltyGraceDays)) {
      setModalAlert({ type: 'error', message: 'Grace period must be from 0 to 31 days.' })
      return
    }

    setModalAlert({ type: 'loading', message: 'Saving SOA and penalty settings...' })
    onSave({
      dpDiscountPercentage,
      downpaymentPercentage,
      downpaymentTerms,
      reservationFeeAppliedToDownpayment: form.reservationFeeTreatment === 'apply_to_downpayment',
      reservationFeeTreatment: form.reservationFeeTreatment,
      monthlyTerms,
      interestRateSource: 'listing',
      firstDueDate: form.firstDueDate || null,
      dailyPenaltyRate,
      penaltyGraceDays,
    })
  }

  const listingInterestRate = Number(getListingValue(listing, ['annualInterestRate'], 0))
  const hasRecordedPayments = Number(getListingValue(listing, ['payment_count'], 0)) > 0
  const selectedPenaltyRateOption = dailyPenaltyRateOptions.includes(Number(form.dailyPenaltyRate))
    ? String(Number(form.dailyPenaltyRate))
    : 'custom'
  const isCustomPenaltyRate = selectedPenaltyRateOption === 'custom'

  const Field = ({ label, value, onChange, type = 'number', placeholder = '', helper, disabled = false, min, max, step }) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={isSaving || disabled}
        className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      />
      {helper ? <span className="text-xs font-semibold text-slate-500">{helper}</span> : null}
    </label>
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
      <form onSubmit={submit} className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">Edit SOA Terms</h3>
            <p className="text-sm font-semibold text-slate-500">Update SOA terms and recompute the amortization schedule.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Close SOA terms modal">
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {modalAlert ? <StatusAlert type={modalAlert.type} message={modalAlert.message} onClose={modalAlert.type === 'loading' ? undefined : () => setModalAlert(null)} className="mb-4" /> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="DP Discount %" value={form.dpDiscountPercentage} onChange={(value) => updateForm('dpDiscountPercentage', value)} placeholder="Example: 5" helper="Discount applied to the computed downpayment total." disabled={hasRecordedPayments} />
            <Field label="Downpayment %" value={form.downpaymentPercentage} onChange={(value) => updateForm('downpaymentPercentage', value)} placeholder="Example: 30" disabled={hasRecordedPayments} />
            <Field label="Downpayment Terms" value={form.downpaymentTerms} onChange={(value) => updateForm('downpaymentTerms', value)} placeholder="Example: 3" disabled={hasRecordedPayments} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-black text-slate-700">Reservation Fee Treatment</span>
              <select
                value={form.reservationFeeTreatment}
                onChange={(event) => updateForm('reservationFeeTreatment', event.target.value)}
                disabled={isSaving || hasRecordedPayments}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="separate">Separate from Downpayment</option>
                <option value="apply_to_downpayment">Deduct Reservation Fee from Downpayment</option>
              </select>
              <span className="text-xs font-semibold text-slate-500">When selected, the reservation fee counts toward the required DP target.</span>
            </label>
            <Field label="Monthly Terms" value={form.monthlyTerms} onChange={(value) => updateForm('monthlyTerms', value)} placeholder="Example: 36" disabled={hasRecordedPayments} />
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-900 md:col-span-2">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Listing Annual Interest Rate</p>
              <p className="mt-1 text-xl font-black">{listingInterestRate.toFixed(2)}%</p>
              <p className="mt-1 text-xs font-semibold text-blue-700">SOA interest always follows the rate set in Edit Listing. Update it there if it needs to change.</p>
            </div>
            <Field label="First Due Date" type="date" value={form.firstDueDate && form.firstDueDate !== '-' ? form.firstDueDate : ''} onChange={(value) => updateForm('firstDueDate', value)} min={firstDueMinimum} helper="Today or later, and not before the reservation starting date." disabled={hasRecordedPayments} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-black text-slate-700">Daily Penalty Rate</span>
              <select
                value={selectedPenaltyRateOption}
                onChange={(event) => updateForm('dailyPenaltyRate', event.target.value === 'custom' ? '' : event.target.value)}
                disabled={isSaving}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
              >
                {dailyPenaltyRateOptions.map((rate) => <option key={rate} value={rate}>{rate}% per day</option>)}
                <option value="custom">Custom</option>
              </select>
              <span className="text-xs font-semibold text-slate-500">Choose a preset or enter a custom rate from 0% to 100% per day.</span>
            </label>
            {isCustomPenaltyRate ? (
              <Field
                label="Custom Daily Penalty Rate (%)"
                value={form.dailyPenaltyRate}
                onChange={(value) => updateForm('dailyPenaltyRate', value)}
                placeholder="Enter 0 to 100"
                helper="This rate remains editable even after payments are recorded."
                min="0"
                max="100"
                step="0.01"
              />
            ) : null}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-black text-slate-700">Penalty-Free Grace Period</span>
              <select value={form.penaltyGraceDays} onChange={(event) => updateForm('penaltyGraceDays', event.target.value)} disabled={isSaving} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100">
                {penaltyGraceDayOptions.map((days) => <option key={days} value={days}>{days === 0 ? 'No grace period (0 days)' : `${days} day${days === 1 ? '' : 's'}`}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
            {isSaving ? 'Saving...' : 'Save SOA Terms'}
          </button>
        </div>
      </form>
    </div>
  )
}

const PaymentsSOA = ({ listing = {}, soaRows = [], payments = [] }) => {
  const { projectSlug, listingId } = useParams()
  const queryClient = useQueryClient()
  const { data: currentUserData } = useCurrentUser()
  const currentUserRole = currentUserData?.user?.role
  const canManagePenaltyRelief = ['admin', 'super_admin'].includes(currentUserRole)
  const canCorrectPenalty = currentUserRole === 'super_admin'

  const rows = useMemo(() => normalizeRows(soaRows), [soaRows])
  const paymentRecords = useMemo(() => normalizePayments(payments, listing), [payments, listing])

  const unitCode = getListingValue(listing, ['unit_id', 'unitCode', 'unitNo'], 'Unit')
  const projectName = getListingValue(listing, ['project_name', 'projectName'], 'Project')
  const buyerName = getListingValue(listing, ['buyer_name', 'buyerName', 'clientName'], '-')
  const displayStatus = getListingValue(listing, ['listing_status', 'status'], 'Available')
  const listingStatusKey = String(
    listing?.rawStatus ||
      listing?.lot_project_listing_status ||
      listing?.listing_status ||
      listing?.status ||
      ''
  )
    .trim()
    .toLowerCase()

  const hasClientProfile = Boolean(
    listing?.hasClientProfile ||
      listing?.clientProfileId ||
      listing?.lot_project_client_profile_id ||
      (buyerName && buyerName !== '-')
  )

  const canUsePayments = Boolean(
    listing?.canUsePayments ??
      (hasClientProfile && !['available', 'hold'].includes(listingStatusKey))
  )

  const noSoaTitle = !hasClientProfile
    ? 'No buyer profile yet'
    : 'No SOA for this unit yet'

  const noSoaMessage = !hasClientProfile
    ? 'Reserve this unit first before creating payments or a statement of account.'
    : 'This unit is still available or on hold, so payments and SOA are not generated yet.'

  const [alert, setAlert] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showSoaTermsModal, setShowSoaTermsModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [deletePayment, setDeletePayment] = useState(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteAlert, setDeleteAlert] = useState(null)
  const [penaltyReliefRow, setPenaltyReliefRow] = useState(null)
  const [penaltyReliefAlert, setPenaltyReliefAlert] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const profileKey = ['lot-listing-profile', projectSlug, listingId]

  const invalidateProfile = () => {
    queryClient.invalidateQueries({ queryKey: profileKey })
    queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
  }

  const createPaymentMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPost(`/projects/lot-projects/${projectSlug}/listings/${listingId}/payments`, payload),
    onSuccess: (result) => {
      setShowPaymentModal(false)
      setEditingPayment(null)
      setAlert({ type: 'success', message: result?.message || 'Payment saved successfully.' })
      invalidateProfile()
    },
  })

  const updatePaymentMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPut(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payments/${payload.paymentId}`,
        payload
      ),
    onSuccess: (result) => {
      setShowPaymentModal(false)
      setEditingPayment(null)
      setAlert({ type: 'success', message: result?.message || 'Payment updated successfully.' })
      invalidateProfile()
    },
  })

  const deletePaymentMutation = useMutation({
    mutationFn: ({ paymentId, superAdminPassword }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payments/${paymentId}/delete`,
        { superAdminPassword }
      ),
    onSuccess: (result) => {
      setDeletePayment(null)
      setDeletePassword('')
      setDeleteAlert(null)
      setAlert({ type: 'success', message: result?.message || 'Payment deleted successfully.' })
      invalidateProfile()
    },
    onError: (error) => {
      setDeleteAlert({ type: 'error', message: error?.message || 'Failed to delete payment.' })
    },
  })

  const updateSoaTermsMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPut(`/projects/lot-projects/${projectSlug}/listings/${listingId}/soa-terms`, payload),
    onSuccess: (result) => {
      setShowSoaTermsModal(false)
      setAlert({ type: 'success', message: result?.message || 'SOA terms saved successfully.' })
      invalidateProfile()
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to save SOA terms.' })
    },
  })

  const grantPenaltyExtensionMutation = useMutation({
    mutationFn: ({ scheduleId, ...payload }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payment-schedules/${scheduleId}/penalty-extension`,
        payload
      ),
    onSuccess: (result) => {
      setPenaltyReliefRow(null)
      setPenaltyReliefAlert(null)
      setAlert({ type: 'success', message: result?.message || 'Penalty-free extension saved.' })
      invalidateProfile()
    },
    onError: (error) => setPenaltyReliefAlert({ type: 'error', message: error?.message || 'Failed to save penalty-free extension.' }),
  })

  const editPenaltyExtensionMutation = useMutation({
    mutationFn: ({ scheduleId, reliefId, ...payload }) =>
      useFetchPut(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payment-schedules/${scheduleId}/penalty-extension/${reliefId}`,
        payload
      ),
    onSuccess: (result) => {
      setPenaltyReliefRow(null)
      setPenaltyReliefAlert(null)
      setAlert({ type: 'success', message: result?.message || 'Penalty-free extension updated.' })
      invalidateProfile()
    },
    onError: (error) => setPenaltyReliefAlert({ type: 'error', message: error?.message || 'Failed to update penalty-free extension.' }),
  })

  const correctPenaltyMutation = useMutation({
    mutationFn: ({ scheduleId, ...payload }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payment-schedules/${scheduleId}/penalty-correction`,
        payload
      ),
    onSuccess: (result) => {
      setPenaltyReliefRow(null)
      setPenaltyReliefAlert(null)
      setAlert({ type: 'success', message: result?.message || 'Penalty reset as a correction.' })
      invalidateProfile()
    },
    onError: (error) => setPenaltyReliefAlert({ type: 'error', message: error?.message || 'Failed to reset penalty.' }),
  })

  const waivePenaltyMutation = useMutation({
    mutationFn: ({ scheduleId, ...payload }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payment-schedules/${scheduleId}/penalty-waiver`,
        payload
      ),
    onSuccess: (result) => {
      setPenaltyReliefRow(null)
      setPenaltyReliefAlert(null)
      setAlert({ type: 'success', message: result?.message || 'Penalty waiver saved.' })
      invalidateProfile()
    },
    onError: (error) => setPenaltyReliefAlert({ type: 'error', message: error?.message || 'Failed to save penalty waiver.' }),
  })

  const restorePenaltyMutation = useMutation({
    mutationFn: ({ reliefId, ...payload }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/penalty-reliefs/${reliefId}/restore`,
        payload
      ),
    onSuccess: (result) => {
      setPenaltyReliefRow(null)
      setPenaltyReliefAlert(null)
      setAlert({ type: 'success', message: result?.message || 'Waived penalty restored.' })
      invalidateProfile()
    },
    onError: (error) => setPenaltyReliefAlert({ type: 'error', message: error?.message || 'Failed to restore waived penalty.' }),
  })

  const handleSaveSoaTerms = (payload) => {
    updateSoaTermsMutation.mutate(payload)
  }

  const filteredPayments = useMemo(() => (
    paymentRecords.filter((payment) => {
      const matchesType = typeFilter === 'all' || payment.type === typeFilter
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter
      return matchesType && matchesStatus
    })
  ), [paymentRecords, typeFilter, statusFilter])

  const totalDue = useMemo(
    () => rows.reduce((sum, row) => {
      const rowTotal = Number(row.totalDue ?? row.dueAmount ?? 0)
      const rowPaid = Number(row.amountPaid || 0)
      return sum + Math.max(rowTotal - rowPaid, 0)
    }, 0),
    [rows]
  )

  const totalPaid = useMemo(
    () => paymentRecords.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [paymentRecords]
  )

  const balloonPrincipalReduction = useMemo(
    () => paymentRecords
      .filter((payment) => String(payment.paymentType || payment.type || '').toLowerCase() === 'balloon')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [paymentRecords]
  )

  const remainingMonthlyTerms = useMemo(
    () => rows.filter((row) => {
      const description = String(row.description || '').toLowerCase()
      return description.includes('monthly') && String(row.status || '').toLowerCase() !== 'cancelled'
    }).length,
    [rows]
  )

  const remainingBalance = useMemo(() => {
    if (!rows.length) return cleanMoney(listing?.balanceAmount ?? listing?.balance)
    return Number(rows[rows.length - 1]?.endingBalance || 0)
  }, [rows, listing])

  const resetFilters = () => {
    setTypeFilter('all')
    setStatusFilter('all')
  }

  const openAddModal = () => {
    setEditingPayment(null)
    setShowPaymentModal(true)
  }

  const openEditModal = (payment) => {
    setEditingPayment(payment)
    setShowPaymentModal(true)
  }

  const handleSavePayment = async (payload) => {
    if (payload.paymentId) {
      await updatePaymentMutation.mutateAsync(payload)
      return
    }

    await createPaymentMutation.mutateAsync(payload)
  }

  const handleDeleteClick = (payment) => {
    setDeletePayment(payment)
    setDeletePassword('')
    setDeleteAlert(null)
  }

  const handleConfirmDelete = () => {
    if (!deletePassword.trim()) {
      setDeleteAlert({ type: 'error', message: 'Super admin password is required.' })
      return
    }

    deletePaymentMutation.mutate({
      paymentId: deletePayment.paymentId || deletePayment.id,
      superAdminPassword: deletePassword,
    })
  }

  if (!canUsePayments) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {alert ? (
          <StatusAlert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
            className="mb-4"
          />
        ) : null}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Payments & SOA</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Payments and SOA are only available after this unit is reserved or sold.
            </p>
          </div>

          <span className="inline-flex h-10 w-fit items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-500">
            Add Payment Disabled
          </span>
        </div>

        <div className="mt-6 rounded-3xl border border-dashed border-blue-200 bg-blue-50 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
            <FiCreditCard className="h-7 w-7" />
          </div>

          <h3 className="mt-4 text-xl font-black text-slate-950">{noSoaTitle}</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold text-slate-600">
            {noSoaMessage}
          </p>

          <div className="mx-auto mt-6 grid max-w-4xl gap-3 text-left md:grid-cols-3">
            <div className="rounded-2xl border border-blue-100 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Unit</p>
              <p className="mt-1 text-sm font-black text-slate-950">{unitCode}</p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Project</p>
              <p className="mt-1 text-sm font-black text-slate-950">{projectName}</p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-1 text-sm font-black text-slate-950">{displayStatus}</p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
          className="mb-4"
        />
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Payments & SOA</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Record verified payments and view the complete computed statement of account.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSoaTermsModal(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
          >
            <FiSettings className="h-4 w-4" />
            Edit SOA Terms
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <FiPlus className="h-4 w-4" />
            Add Payment
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard label="Payment Records" value={paymentRecords.length} isMoney={false} />
        <SummaryCard label="Verified Collections" value={totalPaid} tone="emerald" />
        <SummaryCard label="Balloon Principal Reduction" value={balloonPrincipalReduction} tone="blue" />
        <SummaryCard label="Remaining Monthly Terms" value={remainingMonthlyTerms} isMoney={false} />
        <SummaryCard label="Unpaid Scheduled Due" value={totalDue} tone="blue" />
        <SummaryCard label="Remaining Principal Balance" value={remainingBalance} tone="amber" />
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        >
          <option value="all">All Types</option>
          {paymentTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        >
          <option value="all">All Statuses</option>
          <option value="Verified">Verified</option>
        </select>

        <button
          type="button"
          onClick={resetFilters}
          className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
        >
          Reset Filters
        </button>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-[1150px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  'Client',
                  'Unit',
                  'Project',
                  'Amount',
                  'Type',
                  'Method',
                  'Reference ID',
                  'Payment Date',
                  'Verified By',
                  'Status',
                  'Actions',
                ].map((head) => (
                  <th
                    key={head}
                    className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredPayments.map((payment) => (
                <tr key={payment.paymentId || payment.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-black text-slate-950">
                    {payment.client}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {payment.unit}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {payment.project}
                  </td>

                  <td className="px-4 py-4 font-black text-slate-950">
                    {money(payment.amount)}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {payment.type}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {payment.method}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {payment.referenceId}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {formatDate(payment.paymentDate)}
                  </td>

                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-700">
                      {payment.verifiedBy}
                    </p>
                    {payment.verifiedAt && payment.verifiedAt !== '-' ? (
                      <p className="text-xs font-semibold text-slate-500">
                        {payment.verifiedAt}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-4">
                    <StatusPill status={payment.status} />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(payment)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteClick(payment)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredPayments.length ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center">
                    <FiCreditCard className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">
                      No payment records yet
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Add a payment to create a verified collection record.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Showing {filteredPayments.length ? 1 : 0}-{filteredPayments.length} of {filteredPayments.length} records
          </p>

          <div className="flex items-center gap-2">
            <select className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700">
              <option>10</option>
              <option>20</option>
              <option>50</option>
            </select>

            <button className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-400">
              Previous
            </button>

            <span className="h-9 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700">
              Page 1 of 1
            </span>

            <button className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-400">
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950">
                Statement of Account
              </h3>
              <p className="text-sm font-semibold text-slate-500">
                Complete SOA schedule with installment penalties, relief history, payments, and remaining principal balance.
              </p>
            </div>

            <div className="text-sm font-black text-slate-700">
              Remaining Principal: {money(remainingBalance)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-white">
              <tr>
                {[
                  'Due Date',
                  'Description',
                  'Beginning Balance',
                  'Monthly Due',
                  'Principal',
                  'Interest',
                  'Discount',
                  'Penalty',
                  'Penalty Relief',
                  'Date Paid',
                  'Amount Paid',
                  'Reference ID',
                  'Status',
                  'Ending Balance',
                  'Actions',
                ].map((head) => (
                  <th
                    key={head}
                    className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {formatDate(row.dueDate)}
                  </td>

                  <td className="px-4 py-3 font-black text-slate-950">
                    {row.description}
                  </td>

                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {money(row.beginningBalance)}
                  </td>

                  <td className="px-4 py-3 font-black text-slate-950">
                    {money(row.dueAmount)}
                  </td>

                  <td className="px-4 py-3 font-semibold text-blue-700">
                    {money(row.principalAmount)}
                  </td>

                  <td className="px-4 py-3 font-semibold text-amber-700">
                    {money(row.interest)}
                  </td>

                  <td className="px-4 py-3 font-semibold text-violet-700">
                    {money(row.discountAmount)}
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-black text-red-700">{money(row.penalty)}</p>
                    {row.penalty > 0 ? (
                      <div className="mt-1 space-y-0.5 text-[11px] font-semibold">
                        <p className="text-emerald-700">Paid {money(row.paidPenaltyAmount)}</p>
                        <p className="text-red-600">Outstanding {money(row.outstandingPenaltyAmount)}</p>
                      </div>
                    ) : null}
                    {row.waivedPenaltyAmount > 0 ? (
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        Waived {money(row.waivedPenaltyAmount)}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-3">
                    {row.activePenaltyExtension ? (
                      <div className="min-w-[180px] rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                        <p className="text-xs font-black uppercase text-blue-700">Extension {row.activePenaltyExtension.status}</p>
                        <p className="mt-1 text-xs font-semibold text-blue-900">
                          Until {formatDate(row.activePenaltyExtension.promisedPaymentDate)}
                        </p>
                      </div>
                    ) : row.penaltyReliefs?.length ? (
                      <span className="text-xs font-black text-slate-600">
                        {row.penaltyReliefs.length} relief record{row.penaltyReliefs.length === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">None</span>
                    )}
                  </td>

                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {formatDate(row.datePaid)}
                  </td>

                  <td className="px-4 py-3 font-black text-emerald-700">
                    {money(row.amountPaid)}
                  </td>

                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {row.referenceId || '-'}
                  </td>

                  <td className="px-4 py-3">
                    <StatusPill status={row.status} />
                  </td>

                  <td className="px-4 py-3 font-black text-slate-950">
                    {money(row.endingBalance)}
                  </td>

                  <td className="px-4 py-3">
                    {row.scheduleType === 'balloon' ? (
                      <span className="text-xs font-semibold text-slate-400">Not applicable</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPenaltyReliefRow(row)
                          setPenaltyReliefAlert(null)
                        }}
                        disabled={
                          !row.scheduleId ||
                          (!row.penaltyReliefs?.length && (!canManagePenaltyRelief || (!row.canGrantPenaltyExtension && !row.canWaivePenalty)))
                        }
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <FiClock className="h-3.5 w-3.5" />
                        {canManagePenaltyRelief ? 'Penalty Relief' : 'Relief History'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {!rows.length ? (
                <tr>
                  <td colSpan={15} className="px-4 py-10 text-center">
                    <FiCheckCircle className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">
                      No SOA schedule yet
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Create the reservation/payment schedule first.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-end">
            <span className="font-semibold text-slate-500">
              Remaining principal balance as of statement date:
            </span>
            <span className="text-lg font-black text-slate-950">
              {money(remainingBalance)}
            </span>
          </div>
        </div>
      </section>

      {showSoaTermsModal ? (
        <SoaTermsModal
          listing={listing}
          isSaving={updateSoaTermsMutation.isPending}
          serverAlert={alert?.type === 'error' ? alert : null}
          onClose={() => {
            if (updateSoaTermsMutation.isPending) return
            setShowSoaTermsModal(false)
          }}
          onSave={handleSaveSoaTerms}
        />
      ) : null}

      {showPaymentModal ? (
        <AddSOAPaymentModal
          listing={listing}
          rows={rows}
          initialPayment={editingPayment}
          mode={editingPayment ? 'edit' : 'add'}
          isSaving={createPaymentMutation.isPending || updatePaymentMutation.isPending}
          onClose={() => {
            setShowPaymentModal(false)
            setEditingPayment(null)
          }}
          onSave={handleSavePayment}
        />
      ) : null}

      {penaltyReliefRow ? (
        <PenaltyReliefModal
          row={penaltyReliefRow}
          alert={penaltyReliefAlert}
          canManage={canManagePenaltyRelief}
          canCorrect={canCorrectPenalty}
          isSaving={grantPenaltyExtensionMutation.isPending || editPenaltyExtensionMutation.isPending || correctPenaltyMutation.isPending || waivePenaltyMutation.isPending || restorePenaltyMutation.isPending}
          onClose={() => {
            if (grantPenaltyExtensionMutation.isPending || editPenaltyExtensionMutation.isPending || correctPenaltyMutation.isPending || waivePenaltyMutation.isPending || restorePenaltyMutation.isPending) return
            setPenaltyReliefRow(null)
            setPenaltyReliefAlert(null)
          }}
          onGrantExtension={(payload) => grantPenaltyExtensionMutation.mutate({ scheduleId: penaltyReliefRow.scheduleId, ...payload })}
          onEditExtension={(payload) => editPenaltyExtensionMutation.mutate({ scheduleId: penaltyReliefRow.scheduleId, ...payload })}
          onCorrect={(payload) => correctPenaltyMutation.mutate({ scheduleId: penaltyReliefRow.scheduleId, ...payload })}
          onWaive={(payload) => waivePenaltyMutation.mutate({ scheduleId: penaltyReliefRow.scheduleId, ...payload })}
          onRestore={(payload) => restorePenaltyMutation.mutate(payload)}
        />
      ) : null}

      <DeletePaymentModal
        payment={deletePayment}
        password={deletePassword}
        setPassword={setDeletePassword}
        alert={deleteAlert}
        isDeleting={deletePaymentMutation.isPending}
        onClose={() => {
          setDeletePayment(null)
          setDeletePassword('')
          setDeleteAlert(null)
        }}
        onConfirm={handleConfirmDelete}
      />
    </section>
  )
}

export default PaymentsSOA
