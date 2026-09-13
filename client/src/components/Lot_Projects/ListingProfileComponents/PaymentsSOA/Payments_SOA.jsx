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
  FiPaperclip,
  FiSettings,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import {useFetchPost, useFetchPut, getDoubleCheckNotice} from '../../../../utils/useFetch'
import useCurrentUser from '../../../../utils/useCurrentUser'
import AddSOAPaymentModal from './AddSOAPaymentModal'
import PenaltyReliefModal from './PenaltyReliefModal'
import PaymentProofModal from './PaymentProofModal'
import { isFullAccessAdministrator } from '../../../../config/permissions'
import { DAILY_PENALTY_RATE_OPTIONS, DEFAULT_DAILY_PENALTY_RATE, formatDailyPenaltyRateOption } from '../../../../config/paymentTerms'

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
    paymentProofCount: Number(payment.paymentProofCount ?? payment.payment_proof_count ?? 0),
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

const PaymentAccountConfirmationModal = ({ data, acknowledged, setAcknowledged, isLoading, onClose, onContinue }) => {
  if (!data) return null
  const recent = Boolean(data.hasRecentPayment)
  const latest = data.latestPayment || null
  const tone = recent
    ? 'border-amber-300 bg-amber-50 text-amber-950'
    : 'border-emerald-300 bg-emerald-50 text-emerald-950'

  return (
    <div className="fixed inset-0 z-[76] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.16em] ${recent ? 'text-amber-700' : 'text-emerald-700'}`}>{recent ? 'Verify Before Adding Payment' : 'Confirm Payment Account'}</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Check the buyer and unit</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">This extra check helps prevent payments from being recorded under the wrong unit.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><FiX /></button>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className={`rounded-2xl border p-4 ${tone}`}>
            <div className="flex items-start gap-3">
              {recent ? <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="font-black">{recent ? 'Recent verified payment detected' : 'No recent verified payment detected'}</p>
                <p className="mt-1 text-sm font-semibold opacity-90">
                  {recent
                    ? `This account has ${Number(data.recentPaymentCount || 0)} verified payment record${Number(data.recentPaymentCount || 0) === 1 ? '' : 's'} within the current month / past 30 days.`
                    : 'No verified payment was recorded for this account within the current month / past 30 days.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Unit</p><p className="mt-1 text-3xl font-black text-blue-800">{data.unitId || '-'}</p></div>
              <div><p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Buyer</p><p className="mt-1 text-xl font-black text-slate-950">{data.buyerName || '-'}</p></div>
              <div><p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Project</p><p className="mt-1 font-black text-slate-800">{data.projectName || '-'}</p></div>
              <div><p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Account</p><p className="mt-1 font-black text-slate-800">{data.accountReference || '-'}</p></div>
            </div>
          </div>

          {recent && latest ? (
            <div className="rounded-2xl border border-amber-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Latest verified payment</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><p className="text-xs font-bold text-slate-500">Amount</p><p className="font-black text-slate-950">{money(latest.amount)}</p></div>
                <div><p className="text-xs font-bold text-slate-500">Payment Date</p><p className="font-black text-slate-950">{formatDate(latest.paymentDate)}</p></div>
                <div><p className="text-xs font-bold text-slate-500">Type</p><p className="font-black text-slate-950">{latest.type || '-'}</p></div>
                <div><p className="text-xs font-bold text-slate-500">Reference</p><p className="break-all font-black text-slate-950">{latest.referenceId || '-'}</p></div>
              </div>
            </div>
          ) : null}

          {recent ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-4 w-4" />
              <span className="text-sm font-bold text-amber-950">I confirmed that <strong>{data.buyerName || 'this buyer'}</strong> and <strong>Unit {data.unitId || '-'}</strong> are correct, and I intend to record another payment for this account.</span>
            </label>
          ) : (
            <p className="text-center text-sm font-black text-slate-700">You are about to record a payment for {data.buyerName || 'this buyer'} • Unit {data.unitId || '-'}.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={onContinue} disabled={isLoading || (recent && !acknowledged)} className={`h-10 rounded-xl px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 ${recent ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {recent ? 'Continue Anyway' : 'Continue to Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

const PaymentCorrectionAuthorizationModal = ({ request, reason, setReason, password, setPassword, verificationId, code, setCode, maskedEmail, alert, isSending, isApplying, onClose, onSendCode, onApply }) => {
  if (!request) return null
  const isVoid = request.action === 'void'
  const payment = request.payment || {}
  const proposed = request.proposed || {}
  const readyForCode = reason.trim().length >= 5 && password.trim().length > 0
  const readyToApply = reason.trim().length >= 5 && verificationId && code.trim().length === 6

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">Controlled Financial Correction</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{isVoid ? 'Void Payment' : 'Authorize Payment Edit'}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Only an exact Super Admin can change an already recorded verified payment.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSending || isApplying} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><FiX /></button>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {alert ? <StatusAlert type={alert.type} message={alert.message} /> : null}
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
            {isVoid
              ? 'This does not erase the payment. It marks the payment Cancelled, reverses its SOA allocation, keeps the audit/history record, and recalculates balances.'
              : 'The system will keep a before/after Audit Trail and rebuild the SOA allocation after the verified payment is corrected.'}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs font-black uppercase text-slate-500">Reference</p><p className="mt-1 break-all font-black text-slate-950">{payment.referenceId || '-'}</p></div>
              <div><p className="text-xs font-black uppercase text-slate-500">Current Amount</p><p className="mt-1 font-black text-slate-950">{money(payment.amount)}</p></div>
              <div><p className="text-xs font-black uppercase text-slate-500">Current Date</p><p className="mt-1 font-black text-slate-950">{formatDate(payment.paymentDate)}</p></div>
              <div><p className="text-xs font-black uppercase text-slate-500">Current Type</p><p className="mt-1 font-black text-slate-950">{payment.type || '-'}</p></div>
            </div>
            {!isVoid ? (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">Proposed values</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div><p className="text-xs font-bold text-slate-500">Amount</p><p className="font-black text-blue-800">{money(proposed.amount)}</p></div>
                  <div><p className="text-xs font-bold text-slate-500">Payment Date</p><p className="font-black text-blue-800">{formatDate(proposed.paymentDate)}</p></div>
                  <div><p className="text-xs font-bold text-slate-500">Type</p><p className="font-black text-blue-800">{proposed.paymentType || '-'}</p></div>
                  <div><p className="text-xs font-bold text-slate-500">Method</p><p className="font-black text-blue-800">{proposed.method || '-'}</p></div>
                </div>
              </div>
            ) : null}
          </div>

          <label className="block">
            <span className="text-sm font-black text-slate-700">Correction Reason *</span>
            <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} disabled={Boolean(verificationId)} placeholder="Explain why this recorded payment must be corrected." className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
          </label>

          {!verificationId ? (
            <label className="block">
              <span className="text-sm font-black text-slate-700">Super Admin Password *</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter current password" className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
            </label>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-black text-emerald-900">Password verified</p>
              <p className="mt-1 text-sm font-semibold text-emerald-800">A 6-digit code was sent to {maskedEmail || 'your Super Admin email'}.</p>
              <label className="mt-3 block">
                <span className="text-sm font-black text-emerald-950">Email Verification Code *</span>
                <input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" className="mt-1.5 h-11 w-full rounded-xl border border-emerald-300 bg-white px-3 text-sm font-black tracking-[0.35em] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} disabled={isSending || isApplying} className="h-10 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          {!verificationId ? (
            <button type="button" onClick={onSendCode} disabled={!readyForCode || isSending} className="h-10 rounded-xl bg-amber-600 px-5 text-sm font-black text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300">{isSending ? 'Sending Code...' : 'Verify Password & Send Code'}</button>
          ) : (
            <button type="button" onClick={onApply} disabled={!readyToApply || isApplying} className="h-10 rounded-xl bg-red-600 px-5 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300">{isApplying ? 'Applying...' : isVoid ? 'Confirm & Void Payment' : 'Confirm & Apply Correction'}</button>
          )}
        </div>
      </div>
    </div>
  )
}


const LmfWaiverModal = ({ row, alert, isSaving, onClose, onConfirm }) => {
  const [reason, setReason] = useState('')
  const [approvalReference, setApprovalReference] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [localAlert, setLocalAlert] = useState(null)

  useEffect(() => {
    setReason('')
    setApprovalReference('')
    setInternalNotes('')
    setLocalAlert(null)
  }, [row?.scheduleId])

  if (!row) return null

  const submit = (event) => {
    event.preventDefault()
    if (!reason.trim()) {
      setLocalAlert({ type: 'error', message: 'Reason is required.' })
      return
    }

    onConfirm({
      scheduleId: row.scheduleId,
      reason: reason.trim(),
      approvalReference: approvalReference.trim() || null,
      internalNotes: internalNotes.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 z-[78] flex items-center justify-center bg-slate-950/50 p-4">
      <form onSubmit={submit} className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">Waive Legal / Misc Fee</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Remove the separate LMF from this buyer account without changing the lot principal or monthly schedule.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Close LMF waiver modal">
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {(localAlert || alert) ? <StatusAlert type={(localAlert || alert).type} message={(localAlert || alert).message} onClose={() => setLocalAlert(null)} /> : null}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-amber-700">Separate LMF to waive</p>
            <p className="mt-1 text-2xl font-black text-amber-950">{money(row.dueAmount)}</p>
            <p className="mt-1 text-xs font-semibold text-amber-800">This action is blocked when any verified payment has been applied to the LMF row.</p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-black text-slate-700">Reason <span className="text-red-500">*</span></span>
            <textarea value={reason} onChange={(event) => { setReason(event.target.value); setLocalAlert(null) }} rows={3} placeholder="Why did the developer approve the LMF waiver?" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-black text-slate-700">Developer Approval Reference</span>
            <input value={approvalReference} onChange={(event) => setApprovalReference(event.target.value)} placeholder="Approval letter, email, memo, or reference number" className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-black text-slate-700">Internal Notes</span>
            <textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows={3} placeholder="Optional internal notes" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={isSaving} className="h-10 rounded-lg bg-amber-600 px-5 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300">
            {isSaving ? 'Opening Review...' : 'Proceed to Final Review'}
          </button>
        </div>
      </form>
    </div>
  )
}

const todayManila = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())
const penaltyGraceDayOptions = Array.from({ length: 32 }, (_, index) => index)

const SoaTermsModal = ({ listing = {}, isSaving = false, serverAlert, onClose, onSave }) => {
  const initialDailyPenaltyRate = String(getListingValue(listing, ['soaPenaltyRatePercent'], DEFAULT_DAILY_PENALTY_RATE))
  const [form, setForm] = useState(() => ({
    dpDiscountPercentage: String(getListingValue(listing, ['soaDpDiscountPercentage'], 0)),
    downpaymentPercentage: String(getListingValue(listing, ['soaDownpaymentPercentage'], 30)),
    downpaymentTerms: String(getListingValue(listing, ['soaDownpaymentTerms'], 3)),
    reservationFeeTreatment: getListingValue(listing, ['reservationFeeTreatment'], '') ||
      (getListingValue(listing, ['soaReservationFeeAppliedToDownpayment'], false) ? 'apply_to_downpayment' : 'separate'),
    monthlyTerms: String(getListingValue(listing, ['soaMonthlyTerms'], 36)),
    firstDueDate: getListingValue(listing, ['soaFirstDueDate', 'first_due_date'], ''),
    isHistoricalEntry: Boolean(
      getListingValue(listing, ['soaIsHistoricalEntry'], false) ||
      (() => {
        const startingDate = String(getListingValue(listing, ['soaStartingDate', 'starting_date'], '') || '')
        return startingDate && startingDate < todayManila()
      })()
    ),
    dailyPenaltyRate: initialDailyPenaltyRate,
    penaltyGraceDays: String(getListingValue(listing, ['soaPenaltyGraceDays'], 0)),
    penaltyEffectiveFrom: String(getListingValue(listing, ['soaPenaltyEffectiveFrom'], '') || ''),
  }))
  const [penaltyRateMode, setPenaltyRateMode] = useState(() =>
    DAILY_PENALTY_RATE_OPTIONS.includes(Number(initialDailyPenaltyRate)) ? 'preset' : 'custom'
  )
  const [modalAlert, setModalAlert] = useState({
    type: 'info',
    message: 'Payment schedule fields lock after a payment is recorded. Daily penalty rate, grace period, and penalty effective date stay editable.',
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

  const today = todayManila()
  const listingStartingDate = String(getListingValue(listing, ['soaStartingDate', 'starting_date'], '') || '')
  const firstDueMinimum = form.isHistoricalEntry
    ? (listingStartingDate || undefined)
    : listingStartingDate && listingStartingDate > today
      ? listingStartingDate
      : today
  const firstDueMaximum = form.isHistoricalEntry ? today : undefined

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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.firstDueDate)) {
        setModalAlert({ type: 'error', message: 'First Due Date is required.' })
        return
      }
      if (form.isHistoricalEntry) {
        if (form.firstDueDate > today) {
          setModalAlert({ type: 'error', message: 'Historical First Due Date cannot be after today.' })
          return
        }
      } else if (form.firstDueDate < today) {
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
    const penaltyEffectiveFrom = String(form.penaltyEffectiveFrom || '').trim()
    if (penaltyEffectiveFrom && !/^\d{4}-\d{2}-\d{2}$/.test(penaltyEffectiveFrom)) {
      setModalAlert({ type: 'error', message: 'Penalty Effective From must be a valid date.' })
      return
    }

    setModalAlert({ type: 'loading', message: 'Preparing SOA terms review...' })
    onSave({
      dpDiscountPercentage,
      downpaymentPercentage,
      downpaymentTerms,
      reservationFeeAppliedToDownpayment: form.reservationFeeTreatment === 'apply_to_downpayment',
      reservationFeeTreatment: form.reservationFeeTreatment,
      monthlyTerms,
      interestRateSource: 'listing',
      firstDueDate: form.firstDueDate || null,
      isHistoricalEntry: Boolean(form.isHistoricalEntry),
      dailyPenaltyRate,
      penaltyGraceDays,
      penaltyEffectiveFrom: penaltyEffectiveFrom || null,
    })
  }

  const listingInterestRate = Number(getListingValue(listing, ['annualInterestRate'], 0))
  const hasRecordedPayments = Number(getListingValue(listing, ['payment_count'], 0)) > 0
  const selectedPenaltyRateOption = penaltyRateMode === 'custom'
    ? 'custom'
    : String(Number(form.dailyPenaltyRate))
  const isCustomPenaltyRate = penaltyRateMode === 'custom'

  const Field = ({ label, value, onChange, type = 'number', placeholder = '', example = '', helper, disabled = false, min, max, step }) => (
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
        data-example={example || undefined}
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
            <label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 md:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(form.isHistoricalEntry)}
                onChange={(event) => {
                  const checked = event.target.checked
                  updateForm('isHistoricalEntry', checked)
                  if (!checked && String(form.firstDueDate || '') < today) updateForm('firstDueDate', today)
                }}  
                disabled={isSaving || hasRecordedPayments}
                className="mt-0.5 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
              />
              <span>
                <span className="block text-sm font-black text-blue-950">Allow Backdated SOA Date</span>
                <span className="mt-1 block text-xs font-semibold text-blue-700">
                  Use this when encoding an account that started before today. This option is only available before any payment is recorded. There is no historical lookback limit. The First Due Date cannot be earlier than the saved Starting Date or later than today.
                </span>
              </span>
            </label>
            <Field
              label="First Due Date"
              type="date"
              value={form.firstDueDate && form.firstDueDate !== '-' ? form.firstDueDate : ''}
              onChange={(value) => updateForm('firstDueDate', value)}
              min={firstDueMinimum}
              max={firstDueMaximum}
              helper={form.isHistoricalEntry ? 'Historical date cannot be before the reservation starting date or after today.' : 'Today or later, and not before the reservation starting date.'}
              disabled={hasRecordedPayments}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-black text-slate-700">Daily Penalty Rate</span>
              <select
                value={selectedPenaltyRateOption}
                onChange={(event) => {
                  const nextValue = event.target.value
                  if (nextValue === 'custom') {
                    setPenaltyRateMode('custom')
                    updateForm('dailyPenaltyRate', '')
                  } else {
                    setPenaltyRateMode('preset')
                    updateForm('dailyPenaltyRate', nextValue)
                  }
                }}
                disabled={isSaving}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"
              >
                {DAILY_PENALTY_RATE_OPTIONS.map((rate) => <option key={rate} value={rate}>{formatDailyPenaltyRateOption(rate)}</option>)}
                <option value="custom">Custom</option>
              </select>
              <span className="text-xs font-semibold text-slate-500">Choose 0.01% to 0.10% per day (default 0.05%), or use Custom for another approved rate.</span>
            </label>
            {isCustomPenaltyRate ? (
              <Field
                label="Custom Daily Penalty Rate (%)"
                value={form.dailyPenaltyRate}
                onChange={(value) => updateForm('dailyPenaltyRate', value)}
                placeholder="Enter 0 to 100"
                example="0.15%"
                helper="This rate remains editable even after payments are recorded."
                min="0"
                max="100"
                step="0.01"
              />
            ) : null}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-black text-slate-700">Penalty-Free Grace Period (Days)</span>
              <select value={form.penaltyGraceDays} onChange={(event) => updateForm('penaltyGraceDays', event.target.value)} disabled={isSaving} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100">
                {penaltyGraceDayOptions.map((days) => <option key={days} value={days}>{days === 0 ? 'No grace period (0 days)' : `${days} day${days === 1 ? '' : 's'}`}</option>)}
              </select>
            </label>
            <Field label="Penalty Effective From (Optional)" type="date" value={form.penaltyEffectiveFrom} onChange={(value) => updateForm('penaltyEffectiveFrom', value)} helper="No daily penalty is calculated before this date. Use this for historical accounts that existed before the penalty policy started. Leave blank to use the row due date plus grace period." />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
            {isSaving ? 'Opening Review...' : 'Proceed to Final Review'}
          </button>
        </div>
      </form>
    </div>
  )
}

const PaymentsSOA = ({
  listing = {},
  soaRows = [],
  payments = [],
  readOnly = false,
  profileQueryKey = null,
}) => {
  const { projectSlug, listingId, accountId } = useParams()
  const queryClient = useQueryClient()
  const { data: currentUserData } = useCurrentUser()
  const canManagePenaltyRelief = !readOnly && isFullAccessAdministrator(currentUserData?.user)
  const canCorrectPenalty = canManagePenaltyRelief
  const canWaiveLmf = canManagePenaltyRelief
  const canDeletePaymentProof = !readOnly && isFullAccessAdministrator(currentUserData?.user)
  const isExactSuperAdmin = !readOnly && String(currentUserData?.user?.role || '').trim().toLowerCase() === 'super_admin'

  const rows = useMemo(() => normalizeRows(soaRows), [soaRows])
  const paymentRecords = useMemo(() => normalizePayments(payments, listing), [payments, listing])
  const canonicalReceivable = listing?.financialSnapshot?.receivable || null
  const canonicalCash = listing?.financialSnapshot?.cash || null

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
  const [paymentAccountCheck, setPaymentAccountCheck] = useState(null)
  const [paymentAccountAcknowledged, setPaymentAccountAcknowledged] = useState(false)
  const [paymentCorrection, setPaymentCorrection] = useState(null)
  const [paymentCorrectionReason, setPaymentCorrectionReason] = useState('')
  const [paymentCorrectionPassword, setPaymentCorrectionPassword] = useState('')
  const [paymentCorrectionVerificationId, setPaymentCorrectionVerificationId] = useState(null)
  const [paymentCorrectionCode, setPaymentCorrectionCode] = useState('')
  const [paymentCorrectionMaskedEmail, setPaymentCorrectionMaskedEmail] = useState('')
  const [paymentCorrectionAlert, setPaymentCorrectionAlert] = useState(null)
  const [paymentProof, setPaymentProof] = useState(null)
  const [paymentProofCounts, setPaymentProofCounts] = useState({})
  const [penaltyReliefRow, setPenaltyReliefRow] = useState(null)
  const [penaltyReliefAlert, setPenaltyReliefAlert] = useState(null)
  const [lmfWaiverRow, setLmfWaiverRow] = useState(null)
  const [lmfWaiverAlert, setLmfWaiverAlert] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const activeProfileKey = useMemo(
    () =>
      Array.isArray(profileQueryKey) && profileQueryKey.length
        ? profileQueryKey
        : ['lot-listing-profile', projectSlug, listingId, accountId || 'current'],
    [profileQueryKey, projectSlug, listingId, accountId]
  )

  const refreshProfile = async () => {
    // Refetch the exact route-level profile currently rendered on screen.
    // The current route uses the literal `current` cache scope, while archived
    // routes use their account ID. Do not derive this key from listing.accountId.
    await queryClient.invalidateQueries({
      queryKey: activeProfileKey,
      exact: true,
      refetchType: 'active',
    })

    void queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
    void queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    void queryClient.invalidateQueries({ queryKey: ['lot-payment-logs', projectSlug] })
    void queryClient.invalidateQueries({ queryKey: ['system-payment-notifications'] })
  }

  const paymentPreflightMutation = useMutation({
    mutationFn: () => useFetchPost(
      `/projects/lot-projects/${projectSlug}/listings/${listingId}/payments/preflight`,
      {},
      { confirmationHandled: 'technical' }
    ),
    onSuccess: (result) => {
      setPaymentAccountCheck(result?.data || null)
      setPaymentAccountAcknowledged(false)
    },
    onError: (error) => setAlert(getDoubleCheckNotice(error, 'Unable to verify the buyer account before adding payment.')),
  })

  const createPaymentMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPost(`/projects/lot-projects/${projectSlug}/listings/${listingId}/payments`, payload, {
        doubleCheck: {
          type: 'payment',
          mode: 'create',
          summary: `${getListingValue(listing, ['buyer_name', 'buyerName', 'clientName'], 'Client')} · ${getListingValue(listing, ['unit_id', 'unitCode', 'unitNo'], 'Unit')}`,
          data: {
            account: {
              project: getListingValue(listing, ['project_name', 'projectName'], projectSlug),
              unit: getListingValue(listing, ['unit_id', 'unitCode', 'unitNo'], listingId),
              buyer: getListingValue(listing, ['buyer_name', 'buyerName', 'clientName'], '-'),
              accountReference: getListingValue(listing, ['accountReference', 'account_reference'], '-'),
            },
            payment: payload,
          },
        },
      }),
    onSuccess: async (result) => {
      setShowPaymentModal(false)
      setEditingPayment(null)
      setAlert({ type: 'success', message: result?.message || 'Payment saved successfully.' })
      await refreshProfile()
    },
  })

  const requestPaymentCorrectionCodeMutation = useMutation({
    mutationFn: ({ action, paymentId, password, reason, proposed }) => useFetchPost(
      `/projects/lot-projects/${projectSlug}/listings/${listingId}/payments/${paymentId}/correction-code`,
      { action, password, reason, proposed },
      { confirmationHandled: 'technical' }
    ),
    onMutate: () => setPaymentCorrectionAlert({ type: 'loading', message: 'Verifying Super Admin password and sending email code...' }),
    onSuccess: (result) => {
      setPaymentCorrectionVerificationId(result?.data?.verificationId || null)
      setPaymentCorrectionMaskedEmail(result?.data?.maskedEmail || '')
      setPaymentCorrectionCode('')
      setPaymentCorrectionAlert({ type: 'success', message: result?.message || 'Verification code sent.' })
    },
    onError: (error) => setPaymentCorrectionAlert(getDoubleCheckNotice(error, 'Unable to send payment correction verification code.')),
  })

  const updatePaymentMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPut(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payments/${payload.paymentId}`,
        payload,
        { confirmationHandled: 'compact' }
      ),
    onSuccess: async (result) => {
      setShowPaymentModal(false)
      setEditingPayment(null)
      setPaymentCorrection(null)
      setPaymentCorrectionReason('')
      setPaymentCorrectionPassword('')
      setPaymentCorrectionVerificationId(null)
      setPaymentCorrectionCode('')
      setPaymentCorrectionMaskedEmail('')
      setPaymentCorrectionAlert(null)
      setAlert({ type: 'success', message: result?.message || 'Payment corrected successfully.' })
      await refreshProfile()
    },
    onError: (error) => setPaymentCorrectionAlert(getDoubleCheckNotice(error, 'Failed to correct payment.')),
  })

  const deletePaymentMutation = useMutation({
    mutationFn: ({ paymentId, reason, verificationId, code }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payments/${paymentId}/delete`,
        { reason, verificationId, code },
        { confirmationHandled: 'compact' }
      ),
    onSuccess: async (result) => {
      setPaymentCorrection(null)
      setPaymentCorrectionReason('')
      setPaymentCorrectionPassword('')
      setPaymentCorrectionVerificationId(null)
      setPaymentCorrectionCode('')
      setPaymentCorrectionMaskedEmail('')
      setPaymentCorrectionAlert(null)
      setAlert({ type: 'success', message: result?.message || 'Payment voided successfully.' })
      await refreshProfile()
    },
    onError: (error) => setPaymentCorrectionAlert(getDoubleCheckNotice(error, 'Failed to void payment.')),
  })

  const updateSoaTermsMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPut(`/projects/lot-projects/${projectSlug}/listings/${listingId}/soa-terms`, payload, {
        doubleCheck: {
          type: 'soa-terms',
          summary: `${getListingValue(listing, ['buyer_name', 'buyerName', 'clientName'], 'Client')} · ${getListingValue(listing, ['unit_id', 'unitCode', 'unitNo'], 'Unit')}`,
          data: {
            account: {
              project: getListingValue(listing, ['project_name', 'projectName'], projectSlug),
              unit: getListingValue(listing, ['unit_id', 'unitCode', 'unitNo'], listingId),
              buyer: getListingValue(listing, ['buyer_name', 'buyerName', 'clientName'], '-'),
            },
            soaTerms: payload,
          },
        },
      }),
    onSuccess: async (result) => {
      setShowSoaTermsModal(false)
      setAlert({ type: 'success', message: result?.message || 'SOA terms saved successfully.' })
      await refreshProfile()
    },
    onError: (error) => {
      setAlert(getDoubleCheckNotice(error, 'Failed to save SOA terms.'))
    },
  })

  const waiveLmfMutation = useMutation({
    mutationFn: ({ scheduleId, ...payload }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payment-schedules/${scheduleId}/lmf-waiver`,
        payload,
        { doubleCheck: { type: 'penalty-adjustment', title: 'Review LMF Waiver', confirmLabel: 'Confirm & Waive LMF', actionLabel: 'Waive Legal / Misc Fee', data: { soaRow: lmfWaiverRow || { scheduleId }, waiver: payload } } }
      ),
    onSuccess: async (result) => {
      setLmfWaiverRow(null)
      setLmfWaiverAlert(null)
      setAlert({ type: 'success', message: result?.message || 'Legal / Misc Fee waived successfully.' })
      await refreshProfile()
    },
    onError: (error) => setLmfWaiverAlert(getDoubleCheckNotice(error, 'The Legal / Misc Fee could not be waived.')),
  })

  const grantPenaltyExtensionMutation = useMutation({
    mutationFn: ({ scheduleId, ...payload }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payment-schedules/${scheduleId}/penalty-extension`,
        payload,
        { doubleCheck: { type: 'penalty-adjustment', title: 'Review Penalty-Free Extension', confirmLabel: 'Confirm & Save New Payment Date', actionLabel: 'Penalty-Free Extension', data: { soaRow: penaltyReliefRow || { scheduleId }, extension: payload } } }
      ),
    onSuccess: async (result) => {
      setPenaltyReliefRow(null)
      setPenaltyReliefAlert(null)
      setAlert({ type: 'success', message: result?.message || 'The new penalty-free payment date was saved.' })
      await refreshProfile()
    },
    onError: (error) => setPenaltyReliefAlert(getDoubleCheckNotice(error, 'The new payment date could not be saved.')),
  })

  const editPenaltyExtensionMutation = useMutation({
    mutationFn: ({ scheduleId, reliefId, ...payload }) =>
      useFetchPut(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payment-schedules/${scheduleId}/penalty-extension/${reliefId}`,
        payload,
        { doubleCheck: { type: 'penalty-adjustment', title: 'Review Extension Changes', confirmLabel: 'Confirm & Save Extension', actionLabel: 'Edit Penalty-Free Extension', data: { soaRow: penaltyReliefRow || { scheduleId, reliefId }, extension: payload } } }
      ),
    onSuccess: async (result) => {
      setPenaltyReliefRow(null)
      setPenaltyReliefAlert(null)
      setAlert({ type: 'success', message: result?.message || 'The penalty-free payment date was updated.' })
      await refreshProfile()
    },
    onError: (error) => setPenaltyReliefAlert(getDoubleCheckNotice(error, 'The payment-date extension could not be updated.')),
  })

  const correctPenaltyMutation = useMutation({
    mutationFn: ({ scheduleId, ...payload }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payment-schedules/${scheduleId}/penalty-correction`,
        payload,
        { doubleCheck: { type: 'penalty-adjustment', title: 'Review Penalty Correction', confirmLabel: 'Confirm & Correct Penalty', actionLabel: 'Correct Penalty', data: { soaRow: penaltyReliefRow || { scheduleId }, correction: payload } } }
      ),
    onSuccess: async (result) => {
      setPenaltyReliefRow(null)
      setPenaltyReliefAlert(null)
      setAlert({ type: 'success', message: result?.message || 'The incorrect penalty was cleared.' })
      await refreshProfile()
    },
    onError: (error) => setPenaltyReliefAlert(getDoubleCheckNotice(error, 'The penalty could not be corrected.')),
  })

  const waivePenaltyMutation = useMutation({
    mutationFn: ({ scheduleId, ...payload }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payment-schedules/${scheduleId}/penalty-waiver`,
        payload,
        { doubleCheck: { type: 'penalty-adjustment', title: 'Review Penalty Reduction', confirmLabel: 'Confirm & Reduce Penalty', actionLabel: 'Reduce Penalty', data: { soaRow: penaltyReliefRow || { scheduleId }, reduction: payload } } }
      ),
    onSuccess: async (result) => {
      setPenaltyReliefRow(null)
      setPenaltyReliefAlert(null)
      setAlert({ type: 'success', message: result?.message || 'The penalty reduction was saved.' })
      await refreshProfile()
    },
    onError: (error) => setPenaltyReliefAlert(getDoubleCheckNotice(error, 'The penalty reduction could not be saved.')),
  })

  const restorePenaltyMutation = useMutation({
    mutationFn: ({ reliefId, ...payload }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/penalty-reliefs/${reliefId}/restore`,
        payload,
        { doubleCheck: { type: 'penalty-adjustment', title: 'Review Penalty Restore', confirmLabel: 'Confirm & Restore Penalty', actionLabel: 'Restore Penalty', data: { soaRow: penaltyReliefRow || { reliefId }, restore: payload } } }
      ),
    onSuccess: async (result) => {
      setPenaltyReliefRow(null)
      setPenaltyReliefAlert(null)
      setAlert({ type: 'success', message: result?.message || 'The removed penalty was added back.' })
      await refreshProfile()
    },
    onError: (error) => setPenaltyReliefAlert(getDoubleCheckNotice(error, 'The penalty could not be added back.')),
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

  const localTotalDue = useMemo(
    () => rows.reduce((sum, row) => {
      const rowTotal = Number(row.totalDue ?? row.dueAmount ?? 0)
      const rowPaid = Number(row.amountPaid || 0)
      return sum + Math.max(rowTotal - rowPaid, 0)
    }, 0),
    [rows]
  )
  const totalDue = canonicalReceivable?.totalAccountOutstanding ?? localTotalDue

  const localOverdueSummary = useMemo(() => {
    const today = todayManila()

    return rows.reduce((summary, row) => {
      const status = String(row.status || '').trim().toLowerCase()
      const dueDate = String(row.dueDate || '').slice(0, 10)
      if (status === 'cancelled' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate >= today) return summary

      const totalOutstanding = Math.max(
        Number(row.totalDue ?? row.dueAmount ?? 0) - Number(row.amountPaid || 0),
        0
      )
      if (totalOutstanding <= 0.009) return summary

      const derivedOutstandingPenalty = Math.max(
        Number(row.penalty || 0) - Number(row.paidPenaltyAmount || 0),
        0
      )
      const outstandingPenalty = Math.min(
        totalOutstanding,
        Math.max(Number(row.outstandingPenaltyAmount || 0), derivedOutstandingPenalty)
      )
      const overdueWithoutPenalty = Math.max(totalOutstanding - outstandingPenalty, 0)

      summary.withoutPenalty += overdueWithoutPenalty
      summary.penalty += outstandingPenalty
      summary.withPenalty += totalOutstanding
      summary.rowCount += 1
      return summary
    }, { withoutPenalty: 0, penalty: 0, withPenalty: 0, rowCount: 0 })
  }, [rows])

  const overdueSummary = canonicalReceivable
    ? {
        withoutPenalty: Number(canonicalReceivable.overdueExcludingPenalty || 0),
        penalty: Number(canonicalReceivable.outstandingPenalty || 0),
        withPenalty: Number(canonicalReceivable.totalOverdueIncludingPenalty || 0),
        rowCount: Number(canonicalReceivable.overdueRowCount || 0),
      }
    : localOverdueSummary

  const localOutstandingLmf = useMemo(
    () => rows
      .filter((row) => row.scheduleType === 'legal_misc' && String(row.status || '').toLowerCase() !== 'cancelled')
      .reduce((sum, row) => sum + Math.max(Number(row.totalDue ?? row.dueAmount ?? 0) - Number(row.amountPaid || 0), 0), 0),
    [rows]
  )
  const outstandingLmf = canonicalReceivable?.outstandingLmf ?? localOutstandingLmf

  const lmfWaivedAmount = cleanMoney(getListingValue(listing, ['soaLmfWaivedAmount'], 0))

  const localTotalPaid = useMemo(
    () => paymentRecords.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [paymentRecords]
  )
  const totalPaid = canonicalCash?.verifiedCollections ?? localTotalPaid

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

  const localRemainingBalance = useMemo(() => {
    if (!rows.length) return cleanMoney(listing?.balanceAmount ?? listing?.balance)
    return Number(rows[rows.length - 1]?.endingBalance || 0)
  }, [rows, listing])
  const remainingBalance = canonicalReceivable?.remainingLotPrincipal ?? localRemainingBalance

  const resetFilters = () => {
    setTypeFilter('all')
    setStatusFilter('all')
  }

  const resetPaymentCorrection = () => {
    setPaymentCorrection(null)
    setPaymentCorrectionReason('')
    setPaymentCorrectionPassword('')
    setPaymentCorrectionVerificationId(null)
    setPaymentCorrectionCode('')
    setPaymentCorrectionMaskedEmail('')
    setPaymentCorrectionAlert(null)
  }

  const openAddModal = () => {
    setEditingPayment(null)
    setPaymentAccountCheck(null)
    setPaymentAccountAcknowledged(false)
    paymentPreflightMutation.mutate()
  }

  const continueToAddPayment = () => {
    setPaymentAccountCheck(null)
    setPaymentAccountAcknowledged(false)
    setEditingPayment(null)
    setShowPaymentModal(true)
  }

  const openEditModal = (payment) => {
    if (!isExactSuperAdmin) {
      setAlert({ type: 'error', message: 'Only an exact Super Admin can edit an already recorded payment.' })
      return
    }
    setEditingPayment(payment)
    setShowPaymentModal(true)
  }

  const handlePreviewPayment = (payload) =>
    useFetchPost(`/projects/lot-projects/${projectSlug}/listings/${listingId}/payments/preview`, payload, { confirmationHandled: 'technical' })

  const handleSavePayment = async (payload) => {
    if (payload.paymentId) {
      if (!isExactSuperAdmin) throw new Error('Only an exact Super Admin can edit an already recorded payment.')
      setShowPaymentModal(false)
      setPaymentCorrection({ action: 'edit', payment: editingPayment || {}, proposed: payload })
      setPaymentCorrectionReason('')
      setPaymentCorrectionPassword('')
      setPaymentCorrectionVerificationId(null)
      setPaymentCorrectionCode('')
      setPaymentCorrectionMaskedEmail('')
      setPaymentCorrectionAlert(null)
      return
    }

    await createPaymentMutation.mutateAsync(payload)
  }

  const handleVoidClick = (payment) => {
    if (!isExactSuperAdmin) {
      setAlert({ type: 'error', message: 'Only an exact Super Admin can void an already recorded payment.' })
      return
    }
    setPaymentCorrection({ action: 'void', payment, proposed: null })
    setPaymentCorrectionReason('')
    setPaymentCorrectionPassword('')
    setPaymentCorrectionVerificationId(null)
    setPaymentCorrectionCode('')
    setPaymentCorrectionMaskedEmail('')
    setPaymentCorrectionAlert(null)
  }

  const handleSendPaymentCorrectionCode = () => {
    if (!paymentCorrection) return
    requestPaymentCorrectionCodeMutation.mutate({
      action: paymentCorrection.action,
      paymentId: paymentCorrection.payment?.paymentId || paymentCorrection.payment?.id || paymentCorrection.proposed?.paymentId,
      password: paymentCorrectionPassword,
      reason: paymentCorrectionReason.trim(),
      proposed: paymentCorrection.action === 'edit' ? paymentCorrection.proposed : undefined,
    })
  }

  const handleApplyPaymentCorrection = () => {
    if (!paymentCorrection || !paymentCorrectionVerificationId || paymentCorrectionCode.trim().length !== 6) return
    const paymentId = paymentCorrection.payment?.paymentId || paymentCorrection.payment?.id || paymentCorrection.proposed?.paymentId
    if (paymentCorrection.action === 'edit') {
      updatePaymentMutation.mutate({
        ...paymentCorrection.proposed,
        paymentId,
        reason: paymentCorrectionReason.trim(),
        verificationId: paymentCorrectionVerificationId,
        code: paymentCorrectionCode.trim(),
      })
      return
    }
    deletePaymentMutation.mutate({
      paymentId,
      reason: paymentCorrectionReason.trim(),
      verificationId: paymentCorrectionVerificationId,
      code: paymentCorrectionCode.trim(),
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

      {readOnly ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          <span className="font-black">Read-only account:</span> payments and SOA rows shown here belong only to {listing?.accountReference || 'the selected buyer account'}.
        </div>
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Payments & SOA</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Record verified payments and view the complete computed statement of account.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <>
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
                disabled={paymentPreflightMutation.isPending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                <FiPlus className="h-4 w-4" />
                {paymentPreflightMutation.isPending ? 'Checking Account...' : 'Add Payment'}
              </button>
            </>
          ) : (
            <span className="inline-flex h-11 items-center rounded-xl border border-blue-200 bg-blue-50 px-5 text-sm font-black text-blue-700">Historical record</span>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard label="Payment Records" value={paymentRecords.length} isMoney={false} />
        <SummaryCard label="Total Payments Made" value={totalPaid} tone="emerald" />
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
        {lmfWaivedAmount > 0 ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900">
            <span className="font-black">Legal / Misc Fee waived:</span> {money(lmfWaivedAmount)}
            {listing?.soaLmfWaiverReference ? <span> · Reference: {listing.soaLmfWaiverReference}</span> : null}
          </div>
        ) : null}

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
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500"
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentProof(payment)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                      >
                        <FiPaperclip className="h-3.5 w-3.5" />
                        {Number(paymentProofCounts[payment.paymentId || payment.id] ?? payment.paymentProofCount ?? 0) > 0
                          ? `Proof (${paymentProofCounts[payment.paymentId || payment.id] ?? payment.paymentProofCount})`
                          : 'Upload Proof'}
                      </button>

                      {isExactSuperAdmin ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(payment)}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                            title="Requires Super Admin password and email verification"
                          >
                            <FiEdit2 className="h-3.5 w-3.5" />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleVoidClick(payment)}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100"
                            title="Voids the payment; the historical record is retained"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" />
                            Void
                          </button>
                        </>
                      ) : !readOnly ? (
                        <span className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-400">Super Admin only</span>
                      ) : null}
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

            <div className="grid gap-2 text-right sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">Cash Payments Made</p>
                <p className="mt-0.5 text-sm font-black text-emerald-900">{money(totalPaid)}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-blue-700">Remaining Lot Principal</p>
                <p className="mt-0.5 text-sm font-black text-blue-900">{money(remainingBalance)}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">Outstanding LMF</p>
                <p className="mt-0.5 text-sm font-black text-amber-900">{money(outstandingLmf)}</p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-violet-700">Total Account Outstanding</p>
                <p className="mt-0.5 text-sm font-black text-violet-900">{money(totalDue)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-700">Overdue Overview</p>
                <p className="text-xs font-semibold text-slate-500">Past-due unpaid SOA amounts as of {formatDate(todayManila())}. Partial payments are already deducted.</p>
              </div>
              <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-[11px] font-black text-red-700 ring-1 ring-red-100">
                {overdueSummary.rowCount} overdue row{overdueSummary.rowCount === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-orange-700">Overdue — Excl. Penalty</p>
                <p className="mt-1 text-base font-black text-orange-950">{money(overdueSummary.withoutPenalty)}</p>
                <p className="mt-1 text-[11px] font-semibold text-orange-700">Past-due scheduled balance only</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-red-700">Outstanding Penalties</p>
                <p className="mt-1 text-base font-black text-red-950">{money(overdueSummary.penalty)}</p>
                <p className="mt-1 text-[11px] font-semibold text-red-700">Unpaid penalties on overdue rows</p>
              </div>
              <div className="rounded-xl border border-rose-300 bg-rose-100/70 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-rose-800">Total Overdue — Incl. Penalty</p>
                <p className="mt-1 text-base font-black text-rose-950">{money(overdueSummary.withPenalty)}</p>
                <p className="mt-1 text-[11px] font-semibold text-rose-800">Overdue balance + outstanding penalties</p>
              </div>
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
                  'Penalty Adjustment',
                  'Date Paid',
                  'Amount Paid',
                  'Reference ID',
                  'Status',
                  'Ending Balance',
                  'Actions',
                ].map((head) => (
                  <th
                    key={head}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-slate-50">
                  <td className="min-w-[108px] whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
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
                        Removed {money(row.waivedPenaltyAmount)}
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
                        {row.penaltyReliefs.length} adjustment record{row.penaltyReliefs.length === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">None</span>
                    )}
                  </td>

                  <td className="min-w-[108px] whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
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
                    ) : readOnly ? (
                      <span className="text-xs font-black text-slate-400">Read-only</span>
                    ) : row.scheduleType === 'legal_misc' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setLmfWaiverRow(row)
                          setLmfWaiverAlert(null)
                        }}
                        disabled={!canWaiveLmf || !row.scheduleId || row.amountPaid > 0 || String(row.status || '').toLowerCase() === 'cancelled'}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                        title={row.amountPaid > 0 ? 'Reverse or refund the recorded LMF payment before waiving the fee.' : !canWaiveLmf ? 'Only an admin or super admin can waive LMF.' : 'Waive this separate Legal / Misc Fee.'}
                      >
                        <FiX className="h-3.5 w-3.5" />
                        Waive LMF
                      </button>
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
                        {canManagePenaltyRelief ? 'Penalty Adjustment' : 'Adjustment History'}
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
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-end sm:gap-8">
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="font-semibold text-slate-500">Total payments made:</span>
              <span className="text-lg font-black text-emerald-700">{money(totalPaid)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="font-semibold text-slate-500">Remaining principal balance:</span>
              <span className="text-lg font-black text-slate-950">{money(remainingBalance)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="font-semibold text-slate-500">Outstanding Legal / Misc Fee:</span>
              <span className="text-lg font-black text-amber-700">{money(outstandingLmf)}</span>
            </div>
          </div>
        </div>
      </section>

      {!readOnly && showSoaTermsModal ? (
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

      {!readOnly && showPaymentModal ? (
        <AddSOAPaymentModal
          listing={listing}
          rows={rows}
          initialPayment={editingPayment}
          mode={editingPayment ? 'edit' : 'add'}
          isSaving={createPaymentMutation.isPending || updatePaymentMutation.isPending}
          canWaivePenalty={canManagePenaltyRelief}
          onPreview={handlePreviewPayment}
          onClose={() => {
            setShowPaymentModal(false)
            setEditingPayment(null)
          }}
          onSave={handleSavePayment}
        />
      ) : null}

      {!readOnly && penaltyReliefRow ? (
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

      {!readOnly ? <LmfWaiverModal
        row={lmfWaiverRow}
        alert={lmfWaiverAlert}
        isSaving={waiveLmfMutation.isPending}
        onClose={() => {
          if (waiveLmfMutation.isPending) return
          setLmfWaiverRow(null)
          setLmfWaiverAlert(null)
        }}
        onConfirm={(payload) => waiveLmfMutation.mutate(payload)}
      /> : null}

      {paymentProof ? (
        <PaymentProofModal
          projectSlug={projectSlug}
          listingId={listingId}
          payment={paymentProof}
          readOnly={readOnly}
          canDelete={canDeletePaymentProof}
          onClose={() => setPaymentProof(null)}
          onChanged={refreshProfile}
          onCountChange={(count) => setPaymentProofCounts((current) => ({
            ...current,
            [paymentProof.paymentId || paymentProof.id]: Number(count || 0),
          }))}
        />
      ) : null}

      {!readOnly && paymentAccountCheck ? (
        <PaymentAccountConfirmationModal
          data={paymentAccountCheck}
          acknowledged={paymentAccountAcknowledged}
          setAcknowledged={setPaymentAccountAcknowledged}
          isLoading={paymentPreflightMutation.isPending}
          onClose={() => {
            setPaymentAccountCheck(null)
            setPaymentAccountAcknowledged(false)
          }}
          onContinue={continueToAddPayment}
        />
      ) : null}

      {!readOnly && paymentCorrection ? (
        <PaymentCorrectionAuthorizationModal
          request={paymentCorrection}
          reason={paymentCorrectionReason}
          setReason={(value) => {
            setPaymentCorrectionReason(value)
            if (paymentCorrectionVerificationId) {
              setPaymentCorrectionVerificationId(null)
              setPaymentCorrectionCode('')
              setPaymentCorrectionMaskedEmail('')
            }
          }}
          password={paymentCorrectionPassword}
          setPassword={setPaymentCorrectionPassword}
          verificationId={paymentCorrectionVerificationId}
          code={paymentCorrectionCode}
          setCode={setPaymentCorrectionCode}
          maskedEmail={paymentCorrectionMaskedEmail}
          alert={paymentCorrectionAlert}
          isSending={requestPaymentCorrectionCodeMutation.isPending}
          isApplying={updatePaymentMutation.isPending || deletePaymentMutation.isPending}
          onClose={() => {
            if (requestPaymentCorrectionCodeMutation.isPending || updatePaymentMutation.isPending || deletePaymentMutation.isPending) return
            resetPaymentCorrection()
          }}
          onSendCode={handleSendPaymentCorrectionCode}
          onApply={handleApplyPaymentCorrection}
        />
      ) : null}
    </section>
  )
}

export default PaymentsSOA

