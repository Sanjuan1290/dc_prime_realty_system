import BulkListingReviewPanel from '../../components/Shared/BulkListingReviewPanel'
import ProtectedApprovalDialog from '../../components/Shared/ProtectedApprovalDialog'
import Pagination from '../../../../shared/Pagination'
import { formatPhilippineDateTime } from '../../utils/formatDateTime'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiCheck,
  FiClock,
  FiExternalLink,
  FiRefreshCw,
  FiUserCheck,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReviewFormComparison from '../../components/Shared/ReviewFormComparison'
import ReviewVersionedSpecial from '../../components/Shared/ReviewVersionedSpecial'
import ReviewSensitiveActionSummary from '../../components/Shared/ReviewSensitiveActionSummary'
import PaymentProofReviewFiles from '../../components/Shared/PaymentProofReviewFiles'
import ReviewSignedReceiptFile from '../../components/Shared/ReviewSignedReceiptFile'
import ReviewExtraRecordModal from '../../components/Shared/ReviewExtraRecordModal'
import NetworkImportReviewSummary from '../../components/Shared/NetworkImportReviewSummary'
import { matchSnapshotRecords, RECORD_STATE_STYLES, sameValue } from '../../utils/reviewSnapshotFormat'
import { getReviewRecordLink } from '../../utils/reviewRecordLinks'
import useCurrentUser from '../../utils/useCurrentUser'
import { getDoubleCheckNotice, useFetch, useFetchPost } from '../../utils/useFetch'
import { DEPARTMENT_HEAD_ROLE, DEPARTMENT_STAFF_ROLES, ROLE_LABELS } from '../../config/permissions'

const REVIEW_CENTER_ROLES = new Set(['super_admin','system_admin','auditor','marketing_head','sales_head','accounting_head','operations_head', ...DEPARTMENT_STAFF_ROLES])

const parseJson = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}

const titleCase = (value = '') => String(value || '').replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const fmtDate = (value) => formatPhilippineDateTime(value, { fallback: '—', timeZoneLabel: true })
const statusClass = (status = '') => {
  if (['closed', 'auditor_verified'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (['audit_case_open', 'correction_required'].includes(status)) return 'bg-red-50 text-red-700 border-red-200'
  if (status === 'returned_for_correction') return 'bg-amber-50 text-amber-800 border-amber-200'
  if (['pending_auditor_review', 'pending_auditor_recheck'].includes(status)) return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

const REVIEW_STATUS_LABELS = Object.freeze({
  pending_head_review: 'Awaiting Department Head Review',
  returned_for_correction: 'Returned for Correction',
  pending_auditor_review: 'Awaiting Auditor Review',
  audit_case_open: 'Audit Case Open',
  correction_required: 'Correction Required',
  pending_auditor_recheck: 'Awaiting Verification',
  closed: 'Audit Complete',
  auditor_verified: 'Audit Complete',
})

// System Admin and Super Admin share the owner-level direct-entry path (stored
// as emergency_super_admin), so the label must name whoever actually entered it.
const auditCaseStatusLabel = (auditCase) => auditCase?.final_verified_at ? 'Verified & Closed' : auditCase?.status==='pending_auditor_recheck' ? 'Awaiting Verification' : auditCase?.resolved_at
  ? `Resolved by ${auditCase.resolved_by_role === 'super_admin' ? 'Super Admin' : 'System Admin'}`
  : auditCase?.status === 'pending_system_admin_correction' ? 'Awaiting Correction / Resolution' : titleCase(auditCase?.status)

const directEntryRoleLabel = (review = {}) => (review?.initiated_by_role === 'system_admin' ? 'System Admin' : 'Super Admin')
const approvalTypeLabel = (review = {}) => (review?.approval_type === 'emergency_super_admin'
  ? `${directEntryRoleLabel(review)} direct entry`
  : APPROVAL_TYPE_LABELS[review?.approval_type] || titleCase(review?.approval_type))

// Review Center vocabulary: what reviewers see instead of saved field names.
const SNAPSHOT_LABELS = Object.freeze({
  name: 'Name',
  description: 'Description',
  status: 'Status',
  groupType: 'Network Type',
  headUserId: 'Hierarchy Head',
  broker: 'Broker Details',
  broker_name: 'Broker Name',
  broker_license_number: 'Broker License Number',
  realty_name: 'Realty Name',
  broker_prc_number: 'PRC Number',
  rates: 'Project Rates',
  projectId: 'Project',
  lot_project_id: 'Project',
  poolRate: 'Pool Rate',
  seller_group_pool_rate: 'Pool Rate',
  companyProfitRate: 'Company Profit',
  company_profit_rate: 'Company Profit',
  divisionManagerRate: 'Division Manager Share',
  division_manager_rate: 'Division Manager Share',
  salesDirectorRate: 'Sales Director Share',
  sales_director_rate: 'Sales Director Share',
  unitManagerRate: 'Unit Manager Share',
  unit_manager_rate: 'Unit Manager Share',
  salesAgentRate: 'Sales Agent Share',
  sales_agent_rate: 'Sales Agent Share',
  externalAccount: 'External Representative',
  memberCountBefore: 'Members Before Import',
  importedCount: 'Members Imported',
  networkName: 'Network Name',
  processed: 'Imported Members',
  accredited_seller_id: 'Seller',
  row: 'Spreadsheet Row',
  listingId: 'Unit',
  listingIds: 'Units',
  unitCode: 'Unit Code',
  lotType: 'Lot Type',
  lotAreaSqm: 'Lot Area (sqm)',
  installmentPricePerSqm: 'Installment Price / sqm',
  cashPricePerSqm: 'Cash Price / sqm',
  netSellingPrice: 'Net Selling Price',
  legalMiscRate: 'Legal / Misc Rate',
  legalMiscAmount: 'Legal / Misc Amount',
  reservationFee: 'Reservation Fee',
  annualInterestRate: 'Annual Interest Rate',
  cadastralLots: 'Cadastral Lot Numbers',
  documentRequirements: 'Document Requirements',
  documentCount: 'Document Requirements Count',
  listings: 'Imported Units and Prices',
  removedUnits: 'Removed Units and Prices',
  documentId: 'Document',
  isRequired: 'Required',
  responsibleParty: 'Responsible Party',
  oldUnitIds: 'Previous Unit Codes',
  soldSubstatus: 'Sold Status',
  importedRows: 'Imported Rows',
  batchReference: 'Import Reference',
  filename: 'File Name',
  paymentType: 'Payment Type',
  referenceId: 'Payment Reference',
  unitId: 'Unit',
  groupId: 'Network',
  sellerGroupId: 'Network',
  userId: 'Person',
  tcp: 'TCP',
  lmf: 'Legal / Misc Fee',
  dp: 'Down Payment',
})

// Import-only vocabulary applies equally for Auditor, Staff, Head, and Admin
// because they all use the same ReviewDetails component.
const IMPORT_SNAPSHOT_LABELS = Object.freeze({
  ...SNAPSHOT_LABELS,
  summary: 'Import Summary',
  total: 'Total Spreadsheet Rows',
  ready: 'Valid Rows Ready for Import',
  create: 'New Accounts Created',
  update: 'Existing Accounts Updated',
  existingUpdates: 'Existing Records Affected',
  transfer: 'Members Transferred',
  errors: 'Rows With Errors',
  warnings: 'Import Warnings',
  processed: 'Imported Members',
})

// Reading order for the common fields; everything else keeps its saved order.
const SNAPSHOT_FIELD_ORDER = ['name', 'groupType', 'status', 'broker', 'broker_name', 'broker_license_number', 'realty_name', 'broker_prc_number', 'headUserId', 'description', 'rates']

// Keys that only exist for the system (matching keys, slugs, internal ids of
// the record itself). Reviewers never need to see them.
const isTechnicalSnapshotField = (key = '') => /(_normalized|Normalized)$/.test(String(key))
  || ['projectSlug', 'storageCode', 'storage_code', 'documentRequirementsChanged', 'batchId', 'revision', 'approvalRequestId'].includes(String(key))

// Network project rates get one card per project, rates in a fixed order.
const PROJECT_RATE_FIELDS = Object.freeze([
  ['poolRate', 'seller_group_pool_rate', 'Pool Rate'],
  ['companyProfitRate', 'company_profit_rate', 'Company Profit'],
  ['divisionManagerRate', 'division_manager_rate', 'Division Manager Share'],
  ['salesDirectorRate', 'sales_director_rate', 'Sales Director Share'],
  ['unitManagerRate', 'unit_manager_rate', 'Unit Manager Share'],
  ['salesAgentRate', 'sales_agent_rate', 'Sales Agent Share'],
  ['status', 'seller_group_lot_project_rate_status', 'Status'],
])
const rateFieldValue = (record, [camel, snake]) => (record ? (record[camel] ?? record[snake]) : undefined)
const rateText = (value, isStatus) => {
  if (value === undefined) return 'Not recorded'
  if (value === null || value === '') return 'Not set'
  if (isStatus) return titleCase(value)
  return `${Number(value).toLocaleString('en-PH', { maximumFractionDigits: 4 })}%`
}

const ProjectRatesValue = ({ before = [], after = [], lookups = {}, showUnchanged = false }) => {
  const { entries } = matchSnapshotRecords(before, after)
  const shown = showUnchanged ? entries : entries.filter((entry) => entry.state !== 'unchanged')
  const hiddenCount = entries.length - shown.length
  if (!shown.length && !hiddenCount) return <p className="text-sm font-semibold italic text-slate-400">No accredited projects</p>
  return <div className="grid gap-3 md:grid-cols-2">
    {shown.map((entry) => {
      const record = entry.after || entry.before || {}
      const projectId = record.projectId ?? record.lot_project_id
      const projectName = lookups?.project?.[String(projectId)] || (projectId ? `Project #${projectId}` : 'Project')
      const style = RECORD_STATE_STYLES[entry.state]
      return <div key={`${projectId}-${entry.index}`} className={`rounded-xl border bg-white ${style.border}`}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <p className="text-sm font-black text-slate-900">{projectName}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>{style.label}</span>
        </div>
        <dl className="grid gap-1.5 px-4 py-3">
          {PROJECT_RATE_FIELDS.map((field) => {
            const isStatus = field[2] === 'Status'
            const oldValue = rateFieldValue(entry.before, field)
            const newValue = rateFieldValue(entry.after, field)
            if (entry.state === 'changed' && !showUnchanged && sameValue(oldValue, newValue)) return null
            const shownValue = entry.state === 'removed' ? oldValue : newValue
            return <div key={field[2]} className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="font-semibold text-slate-500">{field[2]}</dt>
              <dd className="text-right font-bold">
                {entry.state === 'changed' && !sameValue(oldValue, newValue)
                  ? <><span className="text-red-800 line-through decoration-red-300">{rateText(oldValue, isStatus)}</span><span className="px-1.5 text-slate-400">to</span><span className="text-emerald-900">{rateText(newValue, isStatus)}</span></>
                  : <span className={entry.state === 'removed' ? 'text-red-800 line-through decoration-red-300' : 'text-slate-900'}>{rateText(shownValue, isStatus)}</span>}
              </dd>
            </div>
          })}
        </dl>
      </div>
    })}
    {hiddenCount ? <p className="text-xs font-semibold text-slate-500 md:col-span-2">{hiddenCount} other {hiddenCount === 1 ? 'project is' : 'projects are'} unchanged.</p> : null}
  </div>
}

const SNAPSHOT_LIST_RENDERERS = Object.freeze({ rates: ProjectRatesValue })

const reviewStatusLabel = (status = '') => REVIEW_STATUS_LABELS[status] || titleCase(status)
const isRoutinePostActionReview = (status = '') => ['pending_head_review', 'pending_auditor_review'].includes(status)

// Guidance must reflect the actual workflow stage and viewer; it never grants an action.
export const reviewTaskGuidance = (review, role, canAct) => {
  if (!canAct) return { title: 'For your reference', detail: 'This review is not waiting for a decision from your account. You can inspect the saved record and review history.' }
  switch (review?.status) {
    case 'pending_auditor_review':
      return { title: 'What you need to check', detail: 'Compare the saved Before and After values. If the change is correct, select Complete Review - No Issue Found. If something is wrong, select Report an Issue to open an Audit Case.' }
    case 'pending_auditor_recheck':
      return { title: 'Recheck the correction', detail: 'Compare the correction with the original finding. Verify the correction if it resolves the issue, or explain what still needs fixing.' }
    case 'pending_head_review':
      return { title: 'Review the saved change', detail: 'Check the recorded information. Confirm it if correct, or return it with a clear explanation of what needs correction.' }
    case 'returned_for_correction':
      return { title: 'Correct and resubmit', detail: 'Read the Department Head’s reason. Correct the affected record using the permitted workflow, then resubmit this review.' }
    case 'correction_required':
      return {title:'Apply Correction',detail:'Correct the record with a reason. The saved correction returns to the Auditor for independent verification.'}
    case 'audit_case_open':
      return { title: 'Follow up on the Audit Case', detail: 'Review the recorded finding and provide the response or decision available to your role.' }
    default:
      return { title: 'Review the saved record', detail: 'Check the recorded values and audit history. Only actions available to your role will be shown.' }
  }
}


const TextActionModal = ({ title, label, placeholder, confirmLabel, helper = '', tone = 'blue', onClose, onConfirm, busy,children=null,confirmDisabled=false }) => {
  const [text, setText] = useState('')
  const classes = tone === 'red' ? 'bg-red-600 hover:bg-red-700' : tone === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
  return <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4">
    <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 p-5"><div><h3 className="text-xl font-black">{title}</h3><p className="mt-1 text-sm font-semibold text-slate-500">This response becomes part of the immutable review history.</p></div><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border p-2"><FiX /></button></header>
      <div className="p-5"><label className="grid gap-2 text-sm font-black text-slate-700">{label}{helper ? <span className="text-xs font-semibold leading-5 text-slate-500">{helper}</span> : null}<textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="rounded-xl border border-slate-300 p-3 font-semibold outline-none focus:border-blue-400" /></label>{children}</div>
      <footer className="flex justify-end gap-2 border-t p-5"><button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border px-5 font-black">Cancel</button><button type="button" onClick={() => onConfirm(text.trim())} disabled={busy || confirmDisabled || text.trim().length < 5} className={`h-11 rounded-xl px-5 font-black text-white disabled:opacity-50 ${classes}`}>{busy ? 'Saving...' : confirmLabel}</button></footer>
    </div>
  </div>
}

const APPROVAL_TYPE_LABELS = {
  staff_entry: 'Staff entry',
  head_self: 'Entered by Head',
  head_preapproved: 'Head pre-approved',
  head_confirmed: 'Head confirmed',
  head_corrected: 'Head corrected',
  emergency_super_admin: 'Super Admin direct entry',
}

export const ReviewDetails = ({ reviewId, onClose, onChanged }) => {
  const navigate = useNavigate()
  const { data: me } = useCurrentUser()
  const actor = me?.user || {}
  const [action, setAction] = useState(null)
  const [assigneeId,setAssigneeId]=useState('')
  const [showExtraPreview,setShowExtraPreview] = useState(false)
  const [notice, setNotice] = useState(null)
  // 4xx answers (no access, not found) are final, so do not retry them; a
  // retry would keep stale action buttons on screen while it waits.
  const query = useQuery({
    queryKey: ['workflow-review', actor.id || 0, actor.role || '', reviewId],
    queryFn: () => useFetch(`/workflow/reviews/${reviewId}`),
    retry: (count, error) => !(Number(error?.status || 0) >= 400 && Number(error?.status || 0) < 500) && count < 2,
    refetchInterval: (result) => result.state.data?.data?.proofFiles?.some((file) => file.malwareScanStatus === 'pending') ? 5000 : false,
  })
  const review = query.data?.data || null
  const auditCase = review?.auditCase || null
  const canAct = review?.viewer ? Boolean(review.viewer.canAct) : true
  const isHead = Boolean(review && canAct && DEPARTMENT_HEAD_ROLE[review.department] === actor.role)
  const isActingAuditor = actor.role === 'auditor' && canAct
  const mutation = useMutation({
    mutationFn: async ({ type, text = '', decision = '' }) => {
      if (type === 'head-confirm') return useFetchPost(`/workflow/reviews/${reviewId}/head-confirm`, { note: text || 'Confirmed — no mistake found.' }, { confirmationHandled: 'compact' })
      if (type === 'return') return useFetchPost(`/workflow/reviews/${reviewId}/return`, { reason: text }, { confirmationHandled: 'compact' })
      if (type === 'manual-resubmit') return useFetchPost(`/workflow/reviews/${reviewId}/resubmit-manual`, { correctionSummary: text }, { confirmationHandled: 'compact' })
      if (type === 'audit-verify') return useFetchPost(`/workflow/reviews/${reviewId}/auditor-verify`, { note: text || 'Verified — no issue found.' }, { confirmationHandled: 'compact' })
      if (type === 'resolve-with-notes') return useFetchPost(`/workflow/audit-cases/${auditCase.audit_case_id}/resolve-with-notes`, { notes: text }, { confirmationHandled: 'compact' })
      if(type==='correction-return')return useFetchPost(`/workflow/reviews/${reviewId}/correction-return`,{comments:text},{confirmationHandled:'compact'})
      if (type === 'open-case') return useFetchPost(`/workflow/reviews/${reviewId}/audit-case`, { finding: text,assigneeId:Number(assigneeId)||undefined }, { confirmationHandled: 'compact' })
      throw new Error('Unknown workflow action.')
    },
    onSuccess: async (result) => {
      setNotice({ type: 'success', message: result.message })
      setAction(null)
      await onChanged?.()
      await query.refetch()
    },
    onError: async (error) => {
      setAction(null)
      // Someone else may have already acted (409). Reload so the page shows
      // the real stage instead of buttons that no longer apply.
      const previousStatus = review?.status
      await onChanged?.()
      const latest = await query.refetch()
      const latestStatus = latest?.data?.data?.status
      if (Number(error?.status || 0) === 409 && latestStatus && latestStatus !== previousStatus) {
        setNotice({ type: 'info', message: 'This review already moved to its next workflow stage. The latest status is now shown below.' })
        return
      }
      setNotice(getDoubleCheckNotice(error, 'Workflow action failed.'))
    },
  })

  const before = parseJson(review?.before_snapshot_json) || {}
  const after = parseJson(review?.after_snapshot_json) || {}
  const recordListingId = after?.listingId || before?.listingId || null
  const recordPaymentId = after?.paymentId || before?.paymentId || null
  const reviewActionKey = String(review?.action_key || '')
  const listingWorkflowAction = reviewActionKey === 'listing.documents.update'
    ? 'listing_documents_update_review'
    : 'listing_edit_review'
  const workflowAction = review?.entity_type === 'lot_project_payment'
    ? 'payment_correction'
    : review?.entity_type === 'lot_project_reservation'
      ? 'reservation_correction'
      : review?.entity_type === 'lot_project_account'
        ? 'reservation_entry_review'
        : review?.entity_type === 'lot_project_client_profile'
          ? 'buyer_profile_edit_review'
          : review?.entity_type === 'lot_project_buyer_form'
            ? 'buyer_form_review'
            : review?.entity_type === 'lot_project_commission'
              ? 'commission_stage_review'
              : review?.entity_type === 'lot_project_payment_proof'
                ? 'payment_proof_review'
                : review?.entity_type === 'lot_project_signed_receipt'
                  ? 'signed_receipt_review'
                  : review?.entity_type === 'lot_project_commission_account'
                    ? (reviewActionKey === 'commission.assigned_seller_change' ? 'seller_change_review' : 'commission_adjustment')
                    : review?.entity_type === 'lot_project_penalty_schedule'
                      ? 'penalty_adjustment'
                      : review?.entity_type === 'lot_project_lmf_schedule'
                        ? 'lmf_correction'
                        : review?.entity_type === 'lot_project_settings'
                          ? 'project_settings_correction'
                          : review?.entity_type === 'lot_project_cancellation'
                            ? 'cancellation_review'
                            : review?.entity_type === 'lot_project_listing'
                              ? listingWorkflowAction
                              : review?.entity_type === 'lot_project_listing_import'
                                ? 'listing_import_review'
                                : review?.entity_type === 'seller_group_project_rates'
                                  ? 'network_rates_review'
                                  : review?.entity_type === 'seller_group'
                                    ? (reviewActionKey === 'network.status' ? 'network_status_review' : 'network_edit_review')
                                    : review?.entity_type === 'accredited_seller'
                                      ? 'seller_edit_review'
                                      : ''
  const isExtraPreview = ['lot_project_payment','lot_project_buyer_form','lot_project_listing_import','lot_project_network_profit_release'].includes(review?.entity_type) || ['network.members.import','network.members.import.undo'].includes(reviewActionKey)
  const isNetworkImportReview = reviewActionKey === 'network.members.import'
  const recordLink = getReviewRecordLink({
    review, actorRole: actor.role, reviewId, auditCaseId: auditCase?.audit_case_id,
    workflowAction, mode: 'view',
  })
  const correctionLink = getReviewRecordLink({
    review, actorRole: actor.role, reviewId, auditCaseId: auditCase?.audit_case_id,
    workflowAction, mode: 'correct',
  })
  const snapshotLabels = isNetworkImportReview ? IMPORT_SNAPSHOT_LABELS : SNAPSHOT_LABELS
  const reviewSnapshotHidden = (key) => isTechnicalSnapshotField(key)
    || (reviewActionKey === 'payment.create' && ['paymentId', 'listingId'].includes(key))
    || (reviewActionKey === 'payment_proof.verify' && ['paymentId', 'listingId', 'proofId', 'proofSequence', 'proofStatus', 'malwareScanStatus'].includes(key))
  const recordActionLabel = review?.entity_type === 'lot_project_payment'
    ? 'Open Payment for Controlled Correction'
    : review?.entity_type === 'lot_project_reservation'
      ? 'Open Reservation Correction'
      : review?.entity_type === 'lot_project_account'
        ? 'Open Reservation'
        : review?.entity_type === 'lot_project_client_profile'
          ? 'Open Buyer Profile Correction'
          : review?.entity_type === 'lot_project_buyer_form'
            ? 'Open Buyer Form Decision'
            : review?.entity_type === 'lot_project_commission'
              ? 'Open Commission'
              : review?.entity_type === 'lot_project_payment_proof'
                ? 'Open Payment Proof Correction'
                : review?.entity_type === 'lot_project_signed_receipt'
                  ? 'Open Signed Receipt Correction'
                  : review?.entity_type === 'lot_project_commission_account'
                    ? (reviewActionKey === 'commission.assigned_seller_change' ? 'Open Seller / Commission' : 'Open Commission Adjustment')
                    : review?.entity_type === 'lot_project_penalty_schedule'
                      ? 'Open Penalty Adjustment'
                      : review?.entity_type === 'lot_project_lmf_schedule'
                        ? 'Open LMF Correction'
                        : review?.entity_type === 'lot_project_settings'
                          ? 'Open Project Settings Correction'
                          : review?.entity_type === 'lot_project_listing_import'
                            ? 'Open Listing Import History'
                            : review?.entity_type === 'seller_group_project_rates'
                              ? 'Open Network Rates'
                              : review?.entity_type === 'seller_group'
                                ? 'Open Network'
                                : review?.entity_type === 'accredited_seller'
                                  ? 'Open Accredited Seller'
                                  : ['lot_project_cancellation', 'lot_project_listing'].includes(review?.entity_type)
                                    ? 'Open Unit'
                                    : 'Open Record'

  const nonCorrectableActionKeys = new Set([
    'reservation.create',
    'buyer_form.approve',
    'commission.release',
    'commission.hold',
    'commission.unhold',
    'listing.delete',
    'listing.import',
    'listing.import_undo',
    'network.members.import',
  ])
  const supportsRecordCorrection = !nonCorrectableActionKeys.has(reviewActionKey)
    && !['lot_project_account', 'lot_project_buyer_form', 'lot_project_commission'].includes(review?.entity_type)
  const operationAlreadyCompleted = isRoutinePostActionReview(review?.status)
  const taskGuidance = reviewTaskGuidance(review, actor.role, canAct)
  const headReviewLabel = review?.head_reviewed_by_name
    || (review?.approval_type === 'emergency_super_admin'
      ? `Not required — entered by ${directEntryRoleLabel(review)}`
      : review?.status === 'pending_head_review'
        ? 'Awaiting Department Head Review'
        : 'Not required / already completed')
  const auditorReviewLabel = review?.auditor_reviewed_by_name
    || (['pending_auditor_review', 'pending_auditor_recheck'].includes(review?.status) ? 'Awaiting Auditor Review' : 'Not reviewed yet')


  // Correct & Confirm opens the authorized record edit page directly.
  // The successful save is folded into the same Review by the backend;
  // no separate claiming step or record lock is required.
  const correctAndConfirm = () => {
    if (correctionLink) navigate(`${correctionLink}${correctionLink.includes('?') ? '&' : '?'}headCorrection=1`)
  }
  const correctionRole = auditCase?.correctionRole || (review?.approval_type === 'emergency_super_admin' || review?.initiated_by_role === 'super_admin' ? 'super_admin' : 'system_admin')
  const correctionRoleLabel = auditCase?.assigned_responder_role === 'super_admin' ? 'Super Admin' : auditCase?.assigned_responder_role === 'system_admin' ? 'System Admin' : 'Administrator'
  const isOriginalStaffCorrection = review?.status === 'returned_for_correction'
    && Number(review?.initiated_by_user_id || 0) === Number(actor?.id || 0)
  const canApplyAuditCorrection = canAct && review?.status === 'correction_required' && ['system_admin','super_admin'].includes(actor?.role)
  const latestCorrectionRequest = [...(review?.events || [])].reverse().find((event) => event.event_type === 'returned_for_correction') || null

  if (query.isLoading) return <main className="grid gap-4"><StatusAlert type="loading" message="Loading review..." /></main>
  if (query.isError) return <main className="grid gap-4"><button type="button" onClick={onClose} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-black text-slate-700"><FiArrowLeft />Back to Review Center</button><StatusAlert type="error" message={query.error?.message || 'Could not load this review. No changes were made.'} /><button type="button" onClick={() => query.refetch()} className="inline-flex w-fit items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700"><FiRefreshCw />Try Again</button></main>
  if (!review) return <main className="grid gap-4"><button type="button" onClick={onClose} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-black text-slate-700"><FiArrowLeft />Back to Review Center</button><StatusAlert type="info" message="Review not found or no longer visible to your account." /></main>

  if(review.entity_type==='lot_project_listing_bulk_batch')return <BulkListingReviewPanel review={review} actor={actor} canAct={canAct} busy={mutation.isPending} notice={notice} onClose={onClose} onDecision={(type,text='')=>mutation.mutate({type,text})}/>

  return <div className="grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"><FiArrowLeft />Back to Review Center</button><p className="text-xs font-semibold text-slate-500">Dedicated review workspace</p></div>
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-black text-blue-700">{review.review_number}</span><span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(review.status)}`}>{reviewStatusLabel(review.status)}</span>{review.approval_type ? <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${review.approval_type === 'emergency_super_admin' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{approvalTypeLabel(review)}</span> : null}</div><h2 className="mt-2 text-2xl font-black">{review.entity_label || titleCase(review.entity_type)}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{titleCase(review.department)} department, {review.action_label || titleCase(review.action_key)}{review.lot_project_name ? `, ${review.lot_project_name}` : ''}</p></div></header>
      <div className="grid gap-5 p-5 sm:p-6">
        {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)} /> : null}
        {!canAct ? <StatusAlert type="info" title="View only" message={review.status === 'closed' || review.status === 'auditor_verified' ? 'This review is complete. Nothing else is needed from anyone.' : `This review is now at "${reviewStatusLabel(review.status)}". Nothing is waiting on your account, so it is shown for reference only.`} /> : null}
        {review.entityExists === false ? <StatusAlert type="info" title="Current record unavailable" message="We could not open the current record. The saved review details below are still available. This does not necessarily mean the record was deleted." /> : null}
        <section id="review-overview" className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5" aria-label="Review overview and next steps">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Review overview</p><h3 className="mt-1 text-lg font-bold text-slate-950">{taskGuidance.title}</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{taskGuidance.detail}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(review.status)}`}>{reviewStatusLabel(review.status)}</span></div>
          <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-3"><div><p className="text-xs font-semibold text-slate-500">Changed by</p><p className="mt-1 font-semibold text-slate-900">{review.initiated_by_name || `User #${review.initiated_by_user_id}`}</p></div><div><p className="text-xs font-semibold text-slate-500">Recorded on</p><p className="mt-1 font-semibold text-slate-900">{fmtDate(review.created_at)}</p></div><div><p className="text-xs font-semibold text-slate-500">Change status</p><p className="mt-1 font-semibold text-slate-900">{operationAlreadyCompleted ? 'Already saved' : 'See saved review details'}</p></div></div>
        </section>
        {operationAlreadyCompleted && canAct ? <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><p className="flex items-center gap-2 font-semibold"><FiCheckCircle className="text-emerald-700" /> Change already saved</p><p className="mt-1 leading-6">This check reviews a change that has already taken effect. Your decision does not automatically undo or lock it.</p><details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-blue-700">How this review works</summary><p className="mt-2 leading-5">Authorized corrections follow the existing workflow and are recorded in Audit Logs. Later edits may require another Department Head review. An open Audit Case does not prevent permitted changes to the record.</p></details></div> : null}
        {review.status === 'returned_for_correction' ? <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex items-start gap-3"><FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div className="min-w-0 flex-1"><p className="font-black">Correction required — action needed</p><p className="mt-1 text-sm font-semibold leading-6 text-amber-900">Your Department Head returned this record for correction. The record remains editable by authorized users. The original Staff member should correct the issue, then resubmit this Review to the Head. If the original operation cannot be edited in place, use a permitted follow-up action and record what you changed. Changes are tracked in Audit Logs.</p>{latestCorrectionRequest?.message ? <div className="mt-3 rounded-xl border border-amber-200 bg-white/80 p-3"><p className="text-xs font-black uppercase tracking-wide text-amber-700">What needs to be corrected</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-amber-950">{latestCorrectionRequest.message}</p><p className="mt-2 text-xs font-semibold text-amber-700">Returned by {latestCorrectionRequest.actor_name || ROLE_LABELS[latestCorrectionRequest.actor_role] || 'Department Head'} · {fmtDate(latestCorrectionRequest.created_at)}</p></div> : null}</div></div></section> : null}
        {review.status === 'correction_required' ? <section className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-950"><div className="flex items-start gap-3"><FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" /><div><p className="font-black">Auditor-confirmed correction required</p><p className="mt-1 text-sm font-semibold leading-6 text-red-900">The Auditor confirmed a real issue. {correctionRoleLabel} is assigned to apply the formal correction. The record remains editable by authorized users; all other edits are traceable in Audit Logs. After the formal correction, the Auditor must recheck it before the case closes.</p></div></div></section> : null}
        <section className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-3"><div><p className="text-xs font-bold uppercase text-slate-500">Entered by</p><p className="mt-1 font-black">{review.initiated_by_name || `User #${review.initiated_by_user_id}`}</p><p className="text-xs font-semibold text-slate-500">{ROLE_LABELS[review.initiated_by_role] || titleCase(review.initiated_by_role)}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Department Head review</p><p className="mt-1 font-black">{headReviewLabel}</p><p className="text-xs font-semibold text-slate-500">{review.head_reviewed_at ? fmtDate(review.head_reviewed_at) : 'Does not block operations'}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Auditor review</p><p className="mt-1 font-black">{auditorReviewLabel}</p><p className="text-xs font-semibold text-slate-500">{review.auditor_reviewed_at ? fmtDate(review.auditor_reviewed_at) : 'Runs after the operation'}</p></div></section>
        <div id="review-changes" className="scroll-mt-24">{isNetworkImportReview && Number(review.revision || 1) <= 1 ? <ReviewVersionedSpecial beforeValue={review.before_snapshot_json} afterValue={review.after_snapshot_json} events={review.events || []} revision={review.revision} actionKey={reviewActionKey}>
          {() => <section className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-black">Before &amp; After</h3><NetworkImportReviewSummary before={before} after={after}/></section>}
        </ReviewVersionedSpecial> : ['seller.manager_replace','commission.assigned_seller_change'].includes(reviewActionKey) || isNetworkImportReview ? <ReviewVersionedSpecial
          beforeValue={review.before_snapshot_json} afterValue={review.after_snapshot_json}
          events={review.events || []} revision={review.revision} actionKey={reviewActionKey}
        >{({ before: selectedBefore, after: selectedAfter }) =>
          isNetworkImportReview
            ? <section className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-black">Before &amp; After</h3><NetworkImportReviewSummary before={parseJson(selectedBefore) || {}} after={parseJson(selectedAfter) || {}}/></section>
            : <ReviewSensitiveActionSummary actionKey={reviewActionKey} beforeValue={selectedBefore} afterValue={selectedAfter}/>
        }</ReviewVersionedSpecial> : <ReviewFormComparison
          beforeValue={review.before_snapshot_json}
          afterValue={review.after_snapshot_json}
          entityType={review.entity_type}
          events={review.events || []}
          revision={review.revision}
          actionKey={reviewActionKey}
          lookups={review.lookups}
          labels={snapshotLabels}
          fieldOrder={SNAPSHOT_FIELD_ORDER}
          isHiddenField={reviewSnapshotHidden}
          listRenderers={SNAPSHOT_LIST_RENDERERS}
        />}</div>
        {review.snapshotRecoveredFromAuditLog ? <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-800">Older price values were recovered from the matching Audit Log. No saved records were changed.</p> : null}
        {reviewActionKey === 'payment_proof.verify' ? <PaymentProofReviewFiles reviewId={reviewId} files={review.proofFiles || []} /> : null}
        {review.entity_type === 'lot_project_signed_receipt' ? <ReviewSignedReceiptFile reviewId={reviewId} before={before} after={after}/> : null}
        {auditCase ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wide text-red-600">Audit Case</p><p className="text-lg font-black text-red-950">{auditCase.case_number}</p></div><span className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-black text-red-700">{auditCaseStatusLabel(auditCase)}</span></div><div className="mt-3 grid gap-3"><div><p className="text-xs font-black uppercase text-red-600">Finding</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.finding}</p></div>{auditCase.resolution_notes ? <div><p className="text-xs font-black uppercase text-emerald-800">Resolved by {auditCase.resolved_by_role === 'super_admin' ? 'Super Admin' : 'System Admin'}</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">{auditCase.resolution_notes}</p><p className="mt-1 text-xs text-slate-600">{auditCase.resolved_by_name} / {fmtDate(auditCase.resolved_at)}</p></div> : null}{auditCase.head_response ? <div><p className="text-xs font-black uppercase text-red-600">Responder Explanation</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.head_response}</p></div> : null}{auditCase.auditor_resolution ? <div><p className="text-xs font-black uppercase text-red-600">Auditor Resolution</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.auditor_resolution}</p></div> : null}{auditCase.correction_summary ? <div><p className="text-xs font-black uppercase text-red-600">{correctionRoleLabel} Correction</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.correction_summary}</p></div> : null}</div></section> : null}
        <section id="review-history" className="scroll-mt-24 rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Review History</p><div className="mt-3 space-y-3">{(review.events || []).map((event) => <div key={event.operational_review_event_id} className="flex gap-3 border-l-2 border-blue-200 pl-3"><div className="min-w-0"><p className="font-black text-slate-800">{titleCase(event.event_type)}</p><p className="text-xs font-semibold text-slate-500">{event.actor_name || ROLE_LABELS[event.actor_role] || 'System'} · {fmtDate(event.created_at)}</p>{event.message ? <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{event.message}</p> : null}</div></div>)}</div></section>

        {isHead && review.status === 'pending_head_review' && !supportsRecordCorrection ? <StatusAlert type="info" message="This action is already completed and cannot be edited in place. If it is incorrect, use Return for Correction to notify the original staff member. They can make an authorized follow-up change, describe the correction, and resubmit the Review for your check. No records are locked." /> : null}
        <section id="review-decision" aria-label="Review decision and available actions" className="scroll-mt-24 space-y-3 border-t border-slate-200 pt-4">
          <div><h3 className="text-base font-bold text-slate-950">Review Decision</h3><p className="mt-1 text-sm text-slate-600">{canAct ? 'Choose an available action once you have checked the saved information.' : 'No review decision is currently assigned to your account. You can still view supporting records when permitted.'}</p></div>
          <div className="flex flex-wrap gap-2">
          {isOriginalStaffCorrection && supportsRecordCorrection && correctionLink ? <button type="button" onClick={() => navigate(correctionLink)} className="h-10 rounded-xl bg-amber-600 px-4 font-black text-white"><FiExternalLink className="mr-2 inline" />Correct &amp; Resubmit</button> : null}
          {isOriginalStaffCorrection && !supportsRecordCorrection ? <button type="button" onClick={() => setAction('manual-resubmit')} disabled={mutation.isPending} className="h-10 rounded-xl bg-amber-600 px-4 font-black text-white">Submit Correction Details for Recheck</button> : null}
          {isHead && review.status === 'pending_head_review' ? <><button type="button" onClick={() => mutation.mutate({ type: 'head-confirm' })} disabled={mutation.isPending} className="h-10 rounded-xl bg-emerald-600 px-4 font-black text-white"><FiCheckCircle className="mr-2 inline" />Confirm — No Mistake</button><button type="button" onClick={() => setAction('return')} disabled={mutation.isPending} className="h-10 rounded-xl bg-amber-600 px-4 font-black text-white">Return for Correction</button></> : null}
          {isActingAuditor && review.status === 'pending_auditor_review' ? <><button type="button" onClick={() => mutation.mutate({ type: 'audit-verify' })} disabled={mutation.isPending} className="h-10 rounded-xl bg-emerald-600 px-4 font-black text-white"><FiCheckCircle className="mr-2 inline" />No Issue</button><button type="button" onClick={() => {setAssigneeId(String(review.correctionAssignees?.[0]?.id||''));setAction('open-case')}} disabled={mutation.isPending} className="h-10 rounded-xl bg-red-600 px-4 font-black text-white"><FiAlertTriangle className="mr-2 inline" />Report Issue</button></> : null}
          {isActingAuditor && review.status==='pending_auditor_recheck' ? <><button type="button" onClick={()=>setAction('verify-correction')} disabled={mutation.isPending} className="h-10 rounded-xl bg-emerald-700 px-4 font-bold text-white">Verified &amp; Closed</button><button type="button" onClick={()=>setAction('correction-return')} disabled={mutation.isPending} className="h-10 rounded-xl border border-red-300 px-4 font-bold text-red-700">Return for Correction</button></> : null}
          {isHead && review.status === 'pending_head_review' && supportsRecordCorrection && correctionLink ? <button type="button" onClick={correctAndConfirm} className="h-10 rounded-xl border border-blue-300 bg-white px-4 font-black text-blue-700"><FiExternalLink className="mr-2 inline" />Correct &amp; Confirm</button> : null}
          {canApplyAuditCorrection && supportsRecordCorrection && correctionLink ? <button type="button" onClick={() => navigate(correctionLink)} className="h-10 rounded-xl bg-violet-700 px-4 font-black text-white"><FiExternalLink className="mr-2 inline" />{recordActionLabel}</button> : null}
          {review?.recordUnavailableReason && !recordLink ? <p role="status" className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{review.recordUnavailableReason}</p> : null}
          {!recordLink && !isExtraPreview && !review?.recordUnavailableReason ? <p role="status" className="w-full text-xs font-semibold text-slate-500">The current record is unavailable. Saved Before &amp; After details remain above.</p> : null}
          <button type="button" onClick={() => document.getElementById('review-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="h-10 rounded-xl border border-slate-300 px-4 font-bold text-slate-700"><FiClock className="mr-2 inline" />View Review History</button>
          {isExtraPreview ? <button type="button" onClick={() => setShowExtraPreview(true)} className="h-10 rounded-xl border border-blue-300 px-4 font-black text-blue-700"><FiExternalLink className="mr-2 inline" />View Record</button> : recordLink ? <button type="button" onClick={() => navigate(recordLink)} className="h-10 rounded-xl border border-slate-300 px-4 font-black text-slate-700"><FiExternalLink className="mr-2 inline" />View Record</button> : null}
          </div>
        </section>
      </div>
    </section>
    {showExtraPreview ? <ReviewExtraRecordModal reviewId={reviewId} onClose={() => setShowExtraPreview(false)}/> : null}
    {action === 'return' ? <TextActionModal title="Return for Correction" label="What needs to be corrected?" helper="The original staff member will receive an action-required alert. Authorized users may still edit the record while this Review waits for the original Staff member to correct and resubmit it." placeholder="Example: Reference ID does not match the deposit slip." confirmLabel="Return & Notify Staff" tone="red" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'return', text })} /> : null}
    {action === 'manual-resubmit' ? <TextActionModal title="Submit Correction for Head Recheck" label="Describe the follow-up correction you completed" helper="Use only after correcting the record through an authorized action (for example, editing affected imported units or reversing/re-importing a batch). State what changed and any reference numbers. The original completed action and its snapshots remain in the audit trail. This does not itself modify the original record." placeholder="Example: Corrected units #2 and #4 in Listings; see audit logs for edits made today. Import reference IMP-2026-000001." confirmLabel="Resubmit to Department Head" tone="blue" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'manual-resubmit', text })} /> : null}
    {action === 'open-case' ? <TextActionModal title="Report Issue" label="Finding" confirmLabel="Report Issue" tone="red" busy={mutation.isPending} confirmDisabled={!assigneeId} onClose={()=>setAction(null)} onConfirm={text=>mutation.mutate({type:'open-case',text})}><label className="mt-3 grid gap-2 text-sm font-semibold">Assign Correction<select aria-label="Correction assignee" value={assigneeId} onChange={event=>setAssigneeId(event.target.value)} className="rounded-lg border p-2"><option value="">Select administrator</option>{(review.correctionAssignees||[]).map(user=><option key={user.id} value={user.id}>{user.name} ({user.role==='super_admin'?'Super Admin':'System Admin'})</option>)}</select></label></TextActionModal> : null}
    {action==='verify-correction'?<TextActionModal title="Verify Correction" label="Verification Notes" confirmLabel="Verified & Closed" tone="emerald" busy={mutation.isPending} onClose={()=>setAction(null)} onConfirm={text=>mutation.mutate({type:'audit-verify',text})}/>:null}
    {action==='correction-return'?<TextActionModal title="Return for Correction" label="Auditor Comments" confirmLabel="Return for Correction" tone="red" busy={mutation.isPending} onClose={()=>setAction(null)} onConfirm={text=>mutation.mutate({type:'correction-return',text})}/>:null}
  </div>
}

const ReviewCenter = () => {
 const navigate=useNavigate(),{data:me}=useCurrentUser(),actor=me?.user||{}
 const owner=['system_admin','super_admin'].includes(actor.role),auditor=actor.role==='auditor',head=Object.values(DEPARTMENT_HEAD_ROLE).includes(actor.role)
 const [tab,setTab]=useState('queue'),[page,setPage]=useState(1),[limit,setLimit]=useState(20),[search,setSearch]=useState(''),[category,setCategory]=useState(''),[approvalPage,setApprovalPage]=useState(1),[opened,setOpened]=useState(null),[notice,setNotice]=useState(null)
 const enabled=REVIEW_CENTER_ROLES.has(actor.role),root='/portal/'+actor.role
 const tabs=owner?[['queue','Correction Queue'],['verification','Awaiting Verification'],['history','Correction History']]:auditor?[['queue','Review Queue'],['cases','Audit Cases'],['history','Review History']]:head?[['queue','Approval Queue'],['returned','Returned Requests'],['history','Approval History']]:[['queue','Returned Requests'],['history','Request History']]
 const params=new URLSearchParams({page,limit,search})
 if(owner){params.set('assigned','me');if(tab!=='queue'){params.set('scope','history');params.set('status',tab==='verification'?'pending_auditor_recheck':'closed')}}
 else if(auditor){if(tab==='cases')params.set('scope','cases');else if(tab==='history')params.set('scope','history');else{params.set('context',category==='progress'?'progress':'review_queue');if(category)params.set('category',category)}}
 else if(head){if(tab!=='queue'){params.set('scope','history');if(tab==='returned')params.set('status','returned_for_correction')}}
 else if(tab==='history')params.set('scope','history')
 const reviews=useQuery({queryKey:['workflow-reviews',actor.id,actor.role,params.toString()],queryFn:()=>useFetch('/workflow/reviews?'+params),enabled})
 const summary=useQuery({queryKey:['workflow-summary',actor.id,actor.role],queryFn:()=>useFetch('/workflow/summary'),enabled,refetchInterval:30000})
 const approvalParams=new URLSearchParams({page:approvalPage,limit,search,status:tab==='queue'?'pending':tab==='returned'?'returned':'approved,rejected,used,expired,cancelled'})
 const approvals=useQuery({queryKey:['workflow-protected-changes',actor.id,approvalParams.toString()],queryFn:()=>useFetch('/workflow/protected-changes?'+approvalParams),enabled:enabled&&head})
 const mutation=useMutation({mutationFn:({decision,note})=>useFetchPost(`/workflow/protected-changes/${opened.protected_change_request_id}/review`,{decision,note},{confirmationHandled:'compact'}),onSuccess:async result=>{setOpened(null);setNotice({type:'success',message:result.message});await Promise.all([approvals.refetch(),reviews.refetch(),summary.refetch()])},onError:error=>setNotice({type:'error',message:error.message})})
 const counts=summary.data?.data||{},rows=reviews.data?.data||[],requests=approvals.data?.data||[]
 const cards=owner?[['Assigned Corrections',counts.assignedCorrections],['Returned Corrections',counts.returnedCorrections],['Awaiting Verification',counts.awaitingVerification],['Completed Corrections',counts.completedCorrections]]:auditor?[['Pending Review Tasks',counts.pendingReviewTasks],['Affected Records',counts.affectedRecords],['Open Audit Cases',counts.openAuditCases],['Awaiting Verification',counts.awaitingVerification]]:head?[['Approval Queue',Number(counts.pendingProtectedChanges||0)+Number(counts.counts?.pending_head_review||0)],['Returned Requests',counts.returnedRequests],['Awaiting Auditor',counts.departmentAwaitingAudit]]:[]
 if(actor.role&&!enabled)return <Navigate to={root} replace/>
 return <main className="grid gap-4">
  <h1 className="text-xl font-black text-slate-950">{owner?'Correction Center':auditor?'Auditor Review Center':head?'Head Review Center':'Review Center'}</h1>
  {notice&&<StatusAlert type={notice.type} message={notice.message} onClose={()=>setNotice(null)}/>}
  {summary.isError&&<StatusAlert type="error" message="Could not load review totals."/>}
  {cards.length>0&&<section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{summary.isError?'—':Number(value||0)}</p></div>)}</section>}
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
   <nav aria-label="Review workspace" className="flex flex-wrap gap-2 border-b p-3">{tabs.map(([key,label])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);setPage(1);setApprovalPage(1)}} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${tab===key?'bg-blue-700 text-white':'bg-slate-100 text-slate-600'}`}>{label}</button>)}</nav>
   <div className="flex flex-wrap gap-3 border-b p-4"><input aria-label="Search reviews" placeholder="Review, batch, Unit ID, project or person" value={search} onChange={event=>{setSearch(event.target.value);setPage(1);setApprovalPage(1)}} className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"/>{auditor&&tab==='queue'&&<select aria-label="Review type" value={category} onChange={event=>{setCategory(event.target.value);setPage(1)}} className="rounded-lg border px-3 py-2 text-sm"><option value="">All Tasks</option><option value="individual">Individual Reviews</option><option value="bulk">Bulk Reviews</option><option value="progress">In Progress</option></select>}</div>
   {head&&<div className="border-b p-4"><h2 className="mb-3 text-sm font-bold">{tab==='queue'?'Approval Requests':tab==='returned'?'Returned Requests':'Approval Decisions'}</h2>{approvals.isError?<StatusAlert type="error" message={approvals.error.message}/>:requests.length?<div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Request','Project / Record','Submitted By','Status',''].map((label,index)=><th key={index} className="p-3">{label}</th>)}</tr></thead><tbody>{requests.map(request=><tr className="border-b" key={request.protected_change_request_id}><td className="p-3 font-mono text-xs text-blue-700">{request.request_number}</td><td className="p-3"><p>{request.entity_label||request.lot_project_name}</p>{request.affected_records>0&&<p className="text-xs text-slate-500">{request.affected_records} records</p>}</td><td className="p-3">{request.requested_by_name}</td><td className="p-3 text-xs">{titleCase(request.status)}</td><td className="p-3"><button className="rounded-lg border px-3 py-2 font-semibold" onClick={()=>setOpened(request)}>Inspect</button></td></tr>)}</tbody></table></div>:<p className="py-4 text-sm text-slate-500">{approvals.isLoading?'Loading…':'No approval requests.'}</p>}<Pagination label="Approval requests pagination" page={approvalPage} pageSize={limit} total={approvals.data?.pagination?.total||0} onPageChange={setApprovalPage} onPageSizeChange={value=>{setLimit(value);setApprovalPage(1);setPage(1)}} disabled={approvals.isFetching}/></div>}
   <div className="p-4">{head&&<h2 className="mb-3 text-sm font-bold">{tab==='queue'?'Saved Changes':'Review History'}</h2>}{reviews.isError?<StatusAlert type="error" message={reviews.error.message}/>:<div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Review','Record / Batch','Project','Submitted By','Records','Status',''].map((label,index)=><th key={index} className="p-3">{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.operational_review_id} className="border-b"><td className="p-3 font-mono text-xs text-blue-700">{row.review_number}</td><td className="p-3 font-semibold">{row.entity_label||row.action_label}</td><td className="p-3">{row.lot_project_name||'—'}</td><td className="p-3">{row.initiated_by_name}</td><td className="p-3">{Number(row.affected_records||1)}</td><td className="p-3"><span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{reviewStatusLabel(row.status)}</span></td><td className="p-3"><button aria-label={'View review '+row.review_number} className="rounded-lg border px-3 py-2 font-semibold" onClick={()=>navigate(root+'/review-center/reviews/'+row.operational_review_id)}>Open</button></td></tr>)}{!rows.length&&<tr><td colSpan={7} className="p-8 text-center text-slate-500">{reviews.isLoading?'Loading…':'No tasks.'}</td></tr>}</tbody></table></div>}<Pagination label="Review queue pagination" page={reviews.data?.pagination?.page||page} pageSize={limit} total={reviews.data?.pagination?.total||0} onPageChange={setPage} onPageSizeChange={value=>{setLimit(value);setPage(1);setApprovalPage(1)}} disabled={reviews.isFetching}/></div>
  </section>
  {opened&&<ProtectedApprovalDialog request={opened} busy={mutation.isPending} error={notice?.type==='error'?notice.message:''} onClose={()=>setOpened(null)} onDecision={(decision,note)=>mutation.mutate({decision,note})}/>}
 </main>
}

export default ReviewCenter
