import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBell,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUserCheck,
  FiX,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReviewSnapshotDiff from '../../components/Shared/ReviewSnapshotDiff'
import NetworkImportReviewSummary from '../../components/Shared/NetworkImportReviewSummary'
import { matchSnapshotRecords, RECORD_STATE_STYLES, sameValue } from '../../utils/reviewSnapshotFormat'
import { getReviewRecordLink } from '../../utils/reviewRecordLinks'
import useCurrentUser from '../../utils/useCurrentUser'
import { getDoubleCheckNotice, useFetch, useFetchPatch, useFetchPost, useFetchPost as postWorkflow } from '../../utils/useFetch'
import { DEPARTMENT_HEAD_ROLE, DEPARTMENT_STAFF_ROLES, ROLE_LABELS } from '../../config/permissions'

const REVIEW_CENTER_ROLES = new Set(['super_admin','system_admin','auditor','marketing_head','sales_head','accounting_head','operations_head', ...DEPARTMENT_STAFF_ROLES])

const getQueueCopy = (role) => {
  if (role === 'auditor') return { title: 'Auditor Review Queue', description: 'Shows only Head-approved work waiting for independent audit, audit findings waiting for your decision, and corrections ready for recheck.' }
  if (role === 'system_admin') return { title: 'System Correction Queue', description: 'Shows only Auditor-confirmed cases that require controlled System Admin correction or an unassigned Head response.' }
  if (role === 'super_admin') return { title: 'Owner Correction Queue', description: 'Shows only correction cases that specifically require Super Admin authority.' }
  if (DEPARTMENT_STAFF_ROLES.includes(role)) return { title: 'My Correction Queue', description: 'Shows only records you entered that your Department Head returned for correction. Open an item, review the reason, correct the record, and resubmit the same Review.' }
  return { title: 'Department Head Review Queue', description: 'Shows only Staff changes from your department and Audit Cases waiting for your explanation.' }
}

const parseJson = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}

const titleCase = (value = '') => String(value || '').replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const fmtDate = (value) => value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const statusClass = (status = '') => {
  if (['closed', 'auditor_verified'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (['returned_for_correction', 'audit_case_open', 'correction_required'].includes(status)) return 'bg-red-50 text-red-700 border-red-200'
  if (['pending_auditor_review', 'pending_auditor_recheck'].includes(status)) return 'bg-violet-50 text-violet-700 border-violet-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

const REVIEW_STATUS_LABELS = Object.freeze({
  pending_head_review: 'Completed · Head Check Pending',
  returned_for_correction: 'Correction Requested · Staff Action Required',
  pending_auditor_review: 'Completed · Auditor Check Pending',
  audit_case_open: 'Audit Case Open',
  correction_required: 'Correction Required',
  pending_auditor_recheck: 'Correction Applied · Auditor Recheck Pending',
  closed: 'Review Complete',
  auditor_verified: 'Review Complete',
})

// System Admin and Super Admin share the owner-level direct-entry path (stored
// as emergency_super_admin), so the label must name whoever actually entered it.
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
  oldUnitIds: 'Previous Unit Codes',
  soldSubstatus: 'Sold Status',
  importedRows: 'Imported Rows',
  batchReference: 'Import Reference',
  filename: 'File Name',
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
  || ['projectSlug', 'storageCode', 'storage_code', 'documentRequirementsChanged', 'batchId', 'revision'].includes(String(key))

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
  if (value === undefined || value === null || value === '') return 'Not set'
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

const TextActionModal = ({ title, label, placeholder, confirmLabel, helper = '', tone = 'blue', onClose, onConfirm, busy }) => {
  const [text, setText] = useState('')
  const classes = tone === 'red' ? 'bg-red-600 hover:bg-red-700' : tone === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
  return <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4">
    <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 p-5"><div><h3 className="text-xl font-black">{title}</h3><p className="mt-1 text-sm font-semibold text-slate-500">This response becomes part of the immutable review history.</p></div><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border p-2"><FiX /></button></header>
      <div className="p-5"><label className="grid gap-2 text-sm font-black text-slate-700">{label}{helper ? <span className="text-xs font-semibold leading-5 text-slate-500">{helper}</span> : null}<textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="rounded-xl border border-slate-300 p-3 font-semibold outline-none focus:border-blue-400" /></label></div>
      <footer className="flex justify-end gap-2 border-t p-5"><button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border px-5 font-black">Cancel</button><button type="button" onClick={() => onConfirm(text.trim())} disabled={busy || text.trim().length < 5} className={`h-11 rounded-xl px-5 font-black text-white disabled:opacity-50 ${classes}`}>{busy ? 'Saving...' : confirmLabel}</button></footer>
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

const ReassignResponderModal = ({ options = [], onClose, onConfirm, busy }) => {
  const [userId, setUserId] = useState('')
  const [reason, setReason] = useState('')
  return <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4">
    <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 p-5"><div><h3 className="text-xl font-black">Reassign who answers this case</h3><p className="mt-1 text-sm font-semibold text-slate-500">Use this when the Head who confirmed the record left or no Head covers the project.</p></div><button type="button" onClick={onClose} disabled={busy} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><FiX /></button></header>
      <div className="grid gap-4 p-5">
        <label className="grid gap-2 text-sm font-black text-slate-700">Department Head
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="h-11 rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-blue-400">
            <option value="">Select a Head</option>
            {options.map((option) => <option key={option.id} value={option.id}>{option.full_name}</option>)}
          </select>
          {!options.length ? <span className="text-xs font-semibold text-amber-700">No active Head covers this project. Create or assign a Head first.</span> : null}
        </label>
        <label className="grid gap-2 text-sm font-black text-slate-700">Reason
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Example: The original Accounting Head has left the company." className="rounded-xl border border-slate-300 p-3 font-semibold outline-none focus:border-blue-400" />
        </label>
      </div>
      <footer className="flex justify-end gap-2 border-t p-5"><button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border px-5 font-black">Cancel</button><button type="button" onClick={() => onConfirm({ userId: Number(userId), reason: reason.trim() })} disabled={busy || !userId || reason.trim().length < 5} className="h-11 rounded-xl bg-violet-700 px-5 font-black text-white disabled:opacity-50">Reassign Responder</button></footer>
    </div>
  </div>
}

export const ReviewDetails = ({ reviewId, onClose, onChanged }) => {
  const navigate = useNavigate()
  const { data: me } = useCurrentUser()
  const actor = me?.user || {}
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState(null)
  // 4xx answers (no access, not found) are final, so do not retry them; a
  // retry would keep stale action buttons on screen while it waits.
  const query = useQuery({
    queryKey: ['workflow-review', actor.id || 0, actor.role || '', reviewId],
    queryFn: () => useFetch(`/workflow/reviews/${reviewId}`),
    retry: (count, error) => !(Number(error?.status || 0) >= 400 && Number(error?.status || 0) < 500) && count < 2,
  })
  const review = query.data?.data || null
  const auditCase = review?.auditCase || null
  const canAct = review?.viewer ? Boolean(review.viewer.canAct) : true
  const isHead = Boolean(review && canAct && DEPARTMENT_HEAD_ROLE[review.department] === actor.role)
  const isActingAuditor = actor.role === 'auditor' && canAct
  const mutation = useMutation({
    mutationFn: async ({ type, text = '', decision = '' }) => {
      if (type === 'claim') return useFetchPost(`/workflow/reviews/${reviewId}/claim`, {}, { confirmationHandled: 'compact' })
      if (type === 'head-confirm') return useFetchPost(`/workflow/reviews/${reviewId}/head-confirm`, { note: text || 'Confirmed — no mistake found.' }, { confirmationHandled: 'compact' })
      if (type === 'return') return useFetchPost(`/workflow/reviews/${reviewId}/return`, { reason: text }, { confirmationHandled: 'compact' })
      if (type === 'audit-verify') return useFetchPost(`/workflow/reviews/${reviewId}/auditor-verify`, { note: text || 'Verified — no issue found.' }, { confirmationHandled: 'compact' })
      if (type === 'audit-recheck-reject') return useFetchPost(`/workflow/reviews/${reviewId}/auditor-verify`, { verified: false, decision: 'reject', note: text }, { confirmationHandled: 'compact' })
      if (type === 'open-case') return useFetchPost(`/workflow/reviews/${reviewId}/audit-case`, { finding: text }, { confirmationHandled: 'compact' })
      if (type === 'head-response') return useFetchPost(`/workflow/audit-cases/${auditCase.audit_case_id}/head-response`, { response: text }, { confirmationHandled: 'compact' })
      if (type === 'resolve-case') return useFetchPost(`/workflow/audit-cases/${auditCase.audit_case_id}/resolve`, { decision, resolution: text }, { confirmationHandled: 'compact' })
      if (type === 'reassign') return postWorkflow(`/workflow/audit-cases/${auditCase.audit_case_id}/reassign-responder`, { userId: decision, reason: text }, { confirmationHandled: 'compact' })
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
                    ? 'commission_adjustment'
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
  const isNetworkImportReview = reviewActionKey === 'network.members.import'
  const recordLink = getReviewRecordLink({
    review, actorRole: actor.role, reviewId, auditCaseId: auditCase?.audit_case_id,
    before, after, workflowAction,
    recordListingId, recordPaymentId,
  })
  const snapshotLabels = isNetworkImportReview ? IMPORT_SNAPSHOT_LABELS : SNAPSHOT_LABELS
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
                    ? 'Open Commission Adjustment'
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
  const headReviewLabel = review?.head_reviewed_by_name
    || (review?.approval_type === 'emergency_super_admin'
      ? `Not required, direct ${directEntryRoleLabel(review)} entry`
      : review?.status === 'pending_head_review'
        ? 'Post-action check pending'
        : 'Not required / already completed')
  const auditorReviewLabel = review?.auditor_reviewed_by_name
    || (['pending_auditor_review', 'pending_auditor_recheck'].includes(review?.status) ? 'Independent check pending' : 'Not reviewed yet')


  // Correct & Confirm (plan item 15): the Head claims the review, opens the
  // record, and saves the corrected values there. The save folds into this
  // review and sends it to the Auditor.
  const correctAndConfirm = async () => {
    try {
      if (!review.claimed_by_user_id) await postWorkflow(`/workflow/reviews/${reviewId}/claim`, {}, { confirmationHandled: 'technical' })
      navigate(`${recordLink}${recordLink.includes('?') ? '&' : '?'}headCorrection=1`)
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    }
  }
  const responders = auditCase?.responders || null
  const canRespondToCase = auditCase?.status === 'awaiting_head_response' && Boolean(responders?.canRespond)
  const canReassignResponder = canAct && auditCase?.status === 'awaiting_head_response' && ['system_admin', 'super_admin'].includes(actor.role)
  const correctionRole = auditCase?.correctionRole || (review?.approval_type === 'emergency_super_admin' || review?.initiated_by_role === 'super_admin' ? 'super_admin' : 'system_admin')
  const correctionRoleLabel = correctionRole === 'super_admin' ? 'Super Admin' : 'System Admin'
  const isOriginalStaffCorrection = review?.status === 'returned_for_correction'
    && Number(review?.initiated_by_user_id || 0) === Number(actor?.id || 0)
  const canApplyAuditCorrection = canAct && review?.status === 'correction_required' && actor?.role === correctionRole
  const latestCorrectionRequest = [...(review?.events || [])].reverse().find((event) => event.event_type === 'returned_for_correction') || null

  if (query.isLoading) return <main className="grid gap-4"><StatusAlert type="loading" message="Loading review..." /></main>
  if (query.isError) return <main className="grid gap-4"><button type="button" onClick={onClose} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-black text-slate-700"><FiArrowLeft />Back to Review Center</button><StatusAlert type="error" message={query.error?.message || 'Failed to load this review.'} /></main>
  if (!review) return <main className="grid gap-4"><button type="button" onClick={onClose} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-black text-slate-700"><FiArrowLeft />Back to Review Center</button><StatusAlert type="info" message="Review not found or no longer visible to your account." /></main>

  return <div className="grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"><FiArrowLeft />Back to Review Center</button><p className="text-xs font-semibold text-slate-500">Dedicated review workspace</p></div>
    {(counts.notificationCountsAvailable === false || counts.protectedCountsAvailable === false) ? <p role="status" className="text-sm text-amber-800">Some alert totals are temporarily unavailable. Your review queue is still accessible; retry Refresh or contact your system administrator if this persists.</p> : null}
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-black text-blue-700">{review.review_number}</span><span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(review.status)}`}>{reviewStatusLabel(review.status)}</span>{review.approval_type ? <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${review.approval_type === 'emergency_super_admin' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{approvalTypeLabel(review)}</span> : null}</div><h2 className="mt-2 text-2xl font-black">{review.entity_label || titleCase(review.entity_type)}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{titleCase(review.department)} department, {review.action_label || titleCase(review.action_key)}{review.lot_project_name ? `, ${review.lot_project_name}` : ''}</p></div></header>
      <div className="grid gap-5 p-5 sm:p-6">
        {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)} /> : null}
        {!canAct ? <StatusAlert type="info" title="View only" message={review.status === 'closed' || review.status === 'auditor_verified' ? 'This review is complete. Nothing else is needed from anyone.' : `This review is now at "${reviewStatusLabel(review.status)}". Nothing is waiting on your account, so it is shown for reference only.`} /> : null}
        {review.entityExists === false ? <StatusAlert type="info" message="The original record was deleted. The values below are what was saved at the time of this review." /> : null}
        {operationAlreadyCompleted && canAct ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><div className="flex items-start gap-3"><FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><p className="font-black">Operation saved successfully</p><p className="mt-1 text-sm font-semibold leading-6 text-emerald-800">The change is already active. This Review is a post-action quality check and never locks the record. Authorized edits remain available during returned corrections and open Audit Cases. Every saved change is traceable in Audit Logs; newer routine edits may require another Head check.</p></div></div></section> : null}
        {review.status === 'returned_for_correction' ? <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex items-start gap-3"><FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div className="min-w-0 flex-1"><p className="font-black">Correction required — action needed</p><p className="mt-1 text-sm font-semibold leading-6 text-amber-900">Your Department Head returned this record for correction. The record remains editable by authorized users. The original Staff member should correct the issue and resubmit this Review to the Head. Changes are tracked in Audit Logs.</p>{latestCorrectionRequest?.message ? <div className="mt-3 rounded-xl border border-amber-200 bg-white/80 p-3"><p className="text-xs font-black uppercase tracking-wide text-amber-700">What needs to be corrected</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-amber-950">{latestCorrectionRequest.message}</p><p className="mt-2 text-xs font-semibold text-amber-700">Returned by {latestCorrectionRequest.actor_name || ROLE_LABELS[latestCorrectionRequest.actor_role] || 'Department Head'} · {fmtDate(latestCorrectionRequest.created_at)}</p></div> : null}</div></div></section> : null}
        {review.status === 'correction_required' ? <section className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-950"><div className="flex items-start gap-3"><FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" /><div><p className="font-black">Auditor-confirmed correction required</p><p className="mt-1 text-sm font-semibold leading-6 text-red-900">The Auditor confirmed a real issue. {correctionRoleLabel} is assigned to apply the formal correction. The record remains editable by authorized users; all other edits are traceable in Audit Logs. After the formal correction, the Auditor must recheck it before the case closes.</p></div></div></section> : null}
        <section className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-3"><div><p className="text-xs font-black uppercase text-slate-400">Entered by</p><p className="mt-1 font-black">{review.initiated_by_name || `User #${review.initiated_by_user_id}`}</p><p className="text-xs font-semibold text-slate-500">{ROLE_LABELS[review.initiated_by_role] || titleCase(review.initiated_by_role)}</p></div><div><p className="text-xs font-black uppercase text-slate-400">Department Check</p><p className="mt-1 font-black">{headReviewLabel}</p><p className="text-xs font-semibold text-slate-500">{review.head_reviewed_at ? fmtDate(review.head_reviewed_at) : 'Does not block operations'}</p></div><div><p className="text-xs font-black uppercase text-slate-400">Independent Audit</p><p className="mt-1 font-black">{auditorReviewLabel}</p><p className="text-xs font-semibold text-slate-500">{review.auditor_reviewed_at ? fmtDate(review.auditor_reviewed_at) : 'Runs after the operation'}</p></div></section>
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-base font-black text-slate-900">What changed</h3>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">Only the values that differ are listed. Internal field names and raw JSON are intentionally hidden; open the full record below if you need everything.</p>
          </div>
          <div className="p-4">
            {isNetworkImportReview
              ? <NetworkImportReviewSummary before={before} after={after} />
              : <ReviewSnapshotDiff beforeValue={review.before_snapshot_json} afterValue={review.after_snapshot_json} lookups={review.lookups} labels={snapshotLabels} fieldOrder={SNAPSHOT_FIELD_ORDER} isHiddenField={isTechnicalSnapshotField} listRenderers={SNAPSHOT_LIST_RENDERERS} mode="changes" />}
          </div>
        </section>
        <details className="rounded-2xl border border-slate-200 bg-slate-50">
          <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-700">Show the full record before and after</summary>
          <div className="border-t border-slate-200 bg-white p-4"><ReviewSnapshotDiff beforeValue={review.before_snapshot_json} afterValue={review.after_snapshot_json} lookups={review.lookups} labels={snapshotLabels} fieldOrder={SNAPSHOT_FIELD_ORDER} isHiddenField={isTechnicalSnapshotField} listRenderers={SNAPSHOT_LIST_RENDERERS} mode="full" /></div>
        </details>
        {auditCase ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wide text-red-600">Audit Case</p><p className="text-lg font-black text-red-950">{auditCase.case_number}</p></div><span className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-black text-red-700">{titleCase(auditCase.status)}</span></div><div className="mt-3 grid gap-3"><div><p className="text-xs font-black uppercase text-red-600">Finding</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.finding}</p></div>{auditCase.head_response ? <div><p className="text-xs font-black uppercase text-red-600">Responder Explanation</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.head_response}</p></div> : null}{auditCase.auditor_resolution ? <div><p className="text-xs font-black uppercase text-red-600">Auditor Resolution</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.auditor_resolution}</p></div> : null}{auditCase.correction_summary ? <div><p className="text-xs font-black uppercase text-red-600">{correctionRoleLabel} Correction</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.correction_summary}</p></div> : null}{responders ? <div><p className="text-xs font-black uppercase text-red-600">Who must answer</p><p className="mt-1 text-sm font-semibold text-red-950">{responders.label}{responders.users?.length ? `: ${responders.users.map((user) => user.full_name).join(', ')}` : ': nobody is available. An administrator must reassign the responder.'}</p></div> : null}</div></section> : null}
        <section className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Review History</p><div className="mt-3 space-y-3">{(review.events || []).map((event) => <div key={event.operational_review_event_id} className="flex gap-3 border-l-2 border-blue-200 pl-3"><div className="min-w-0"><p className="font-black text-slate-800">{titleCase(event.event_type)}</p><p className="text-xs font-semibold text-slate-500">{event.actor_name || ROLE_LABELS[event.actor_role] || 'System'} · {fmtDate(event.created_at)}</p>{event.message ? <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{event.message}</p> : null}</div></div>)}</div></section>

        {isHead && review.status === 'pending_head_review' && !supportsRecordCorrection ? <StatusAlert type="info" message="This action is already completed and has no safe in-place correction endpoint. Open the record for any compensating action, then confirm the review only when the recorded action is accurate." /> : null}
        <section className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          {isOriginalStaffCorrection && supportsRecordCorrection && recordLink ? <button type="button" onClick={() => navigate(recordLink)} className="h-10 rounded-xl bg-amber-600 px-4 font-black text-white"><FiExternalLink className="mr-2 inline" />Correct &amp; Resubmit</button> : null}
          {isHead && review.status === 'pending_head_review' ? <><button type="button" onClick={() => mutation.mutate({ type: 'claim' })} disabled={mutation.isPending} className="h-10 rounded-xl border border-blue-200 bg-blue-50 px-4 font-black text-blue-700"><FiUserCheck className="mr-2 inline" />Claim Review</button><button type="button" onClick={() => mutation.mutate({ type: 'head-confirm' })} disabled={mutation.isPending} className="h-10 rounded-xl bg-emerald-600 px-4 font-black text-white"><FiCheckCircle className="mr-2 inline" />Confirm — No Mistake</button>{supportsRecordCorrection ? <button type="button" onClick={() => setAction('return')} disabled={mutation.isPending} className="h-10 rounded-xl bg-amber-600 px-4 font-black text-white">Return for Correction</button> : null}</> : null}
          {isActingAuditor && review.status === 'pending_auditor_review' ? <><button type="button" onClick={() => mutation.mutate({ type: 'audit-verify' })} disabled={mutation.isPending} className="h-10 rounded-xl bg-emerald-600 px-4 font-black text-white"><FiCheckCircle className="mr-2 inline" />Verified — No Issue</button><button type="button" onClick={() => setAction('open-case')} disabled={mutation.isPending} className="h-10 rounded-xl bg-red-600 px-4 font-black text-white"><FiAlertTriangle className="mr-2 inline" />Open Audit Case</button></> : null}
          {canRespondToCase ? <button type="button" onClick={() => setAction('head-response')} className="h-10 rounded-xl bg-blue-600 px-4 font-black text-white">Submit Explanation</button> : null}
          {canReassignResponder ? <button type="button" onClick={() => setAction('reassign')} className="h-10 rounded-xl border border-violet-300 bg-violet-50 px-4 font-black text-violet-800">Reassign Responder</button> : null}
          {isHead && review.status === 'pending_head_review' && supportsRecordCorrection && recordLink && (!review.claimed_by_user_id || Number(review.claimed_by_user_id) === Number(actor.id)) ? <button type="button" onClick={correctAndConfirm} className="h-10 rounded-xl border border-blue-300 bg-white px-4 font-black text-blue-700"><FiExternalLink className="mr-2 inline" />Correct &amp; Confirm</button> : null}
          {isActingAuditor && auditCase?.status === 'under_auditor_review' ? <><button type="button" onClick={() => setAction('resolve-invalid')} className="h-10 rounded-xl border border-emerald-300 bg-emerald-50 px-4 font-black text-emerald-700">Finding Invalid</button><button type="button" onClick={() => setAction('resolve-valid')} className="h-10 rounded-xl bg-red-600 px-4 font-black text-white">Finding Valid</button></> : null}
          {canApplyAuditCorrection && supportsRecordCorrection && recordLink ? <button type="button" onClick={() => navigate(recordLink)} className="h-10 rounded-xl bg-violet-700 px-4 font-black text-white"><FiExternalLink className="mr-2 inline" />{recordActionLabel}</button> : null}
          {isActingAuditor && review.status === 'pending_auditor_recheck' ? <><button type="button" onClick={() => mutation.mutate({ type: 'audit-verify' })} className="h-10 rounded-xl bg-emerald-600 px-4 font-black text-white">Verify Correction & Close</button><button type="button" onClick={() => setAction('recheck-reject')} className="h-10 rounded-xl bg-red-600 px-4 font-black text-white">Correction Still Wrong</button></> : null}
          {review?.recordUnavailableReason && !recordLink ? <p role="status" className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{review.recordUnavailableReason}</p> : null}
          {recordLink && !canApplyAuditCorrection ? <button type="button" onClick={() => navigate(recordLink)} className="h-10 rounded-xl border border-slate-300 px-4 font-black text-slate-700"><FiExternalLink className="mr-2 inline" />Open Record</button> : null}
        </section>
      </div>
    </section>
    {action === 'return' ? <TextActionModal title="Return for Correction" label="What needs to be corrected?" helper="The original staff member will receive an action-required alert. Authorized users may still edit the record while this Review waits for the original Staff member to correct and resubmit it." placeholder="Example: Reference ID does not match the deposit slip." confirmLabel="Return & Notify Staff" tone="red" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'return', text })} /> : null}
    {action === 'open-case' ? <TextActionModal title="Open Audit Case" label="Audit finding" placeholder="Describe the exact mismatch or error." confirmLabel="Open Audit Case" tone="red" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'open-case', text })} /> : null}
    {action === 'head-response' ? <TextActionModal title="Explain Audit Finding" label="Explanation" placeholder="Explain why the recorded values are correct, or acknowledge the mistake." confirmLabel="Submit Explanation" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'head-response', text })} /> : null}
    {action === 'resolve-invalid' ? <TextActionModal title="Mark Finding Invalid" label="Auditor resolution" placeholder="Explain why the original record is valid." confirmLabel="Close as Invalid" tone="emerald" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'resolve-case', decision: 'invalid', text })} /> : null}
    {action === 'resolve-valid' ? <TextActionModal title="Mark Finding Valid" label="Required correction" placeholder={`Explain exactly what ${correctionRoleLabel} must correct.`} confirmLabel={`Send to ${correctionRoleLabel}`} tone="red" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'resolve-case', decision: 'valid', text })} /> : null}
    {action === 'reassign' ? <ReassignResponderModal options={auditCase?.headOptions || []} busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={({ userId, reason }) => mutation.mutate({ type: 'reassign', decision: userId, text: reason })} /> : null}
    {action === 'recheck-reject' ? <TextActionModal title="Correction Still Wrong" label="What still needs to be fixed?" placeholder="Describe the remaining error." confirmLabel={`Return to ${correctionRoleLabel}`} tone="red" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'audit-recheck-reject', text })} /> : null}
  </div>
}

const ReviewCenter = () => {
  const navigate = useNavigate()
  const { data: me } = useCurrentUser()
  const actor = me?.user || {}
  const isHead = Boolean(Object.values(DEPARTMENT_HEAD_ROLE).includes(actor.role))
  const queueCopy = getQueueCopy(actor.role)
  const [tab, setTab] = useState('reviews')
  const [status, setStatus] = useState('')
  const [reviewScope, setReviewScope] = useState('queue')
  const [reviewPage, setReviewPage] = useState(1)
  const [search, setSearch] = useState('')
  const [approvalStatus, setApprovalStatus] = useState('')
  const [notice, setNotice] = useState(null)
  // Keys include the account so a different login never sees a cached queue.
  const summary = useQuery({ queryKey: ['workflow-summary', actor.id || 0, actor.role || ''], queryFn: () => useFetch('/workflow/summary'), enabled: REVIEW_CENTER_ROLES.has(actor.role), refetchInterval: 30_000 })
  const reviews = useQuery({ queryKey: ['workflow-reviews', actor.id || 0, actor.role || '', reviewScope, status, reviewPage], queryFn: () => useFetch(`/workflow/reviews?limit=10&page=${reviewPage}&scope=${reviewScope}${status ? `&status=${encodeURIComponent(status)}` : ''}`), enabled: REVIEW_CENTER_ROLES.has(actor.role) && tab === 'reviews', placeholderData: (previous) => previous })
  const approvals = useQuery({ queryKey: ['workflow-protected-changes', approvalStatus], queryFn: () => useFetch(`/workflow/protected-changes?limit=100${approvalStatus ? `&status=${encodeURIComponent(approvalStatus)}` : ''}`), enabled: REVIEW_CENTER_ROLES.has(actor.role) && isHead && tab === 'approvals' })
  const notifications = useQuery({ queryKey: ['workflow-notifications', actor.id || 0, actor.role || ''], queryFn: () => useFetch('/workflow/notifications?limit=100'), enabled: REVIEW_CENTER_ROLES.has(actor.role) && tab === 'notifications' })
  const approvalMutation = useMutation({
    mutationFn: ({ id, decision }) => useFetchPost(`/workflow/protected-changes/${id}/review`, { decision }, { confirmationHandled: 'compact' }),
    onSuccess: async (result) => { setNotice({ type: 'success', message: result.message }); await Promise.all([approvals.refetch(), summary.refetch()]) },
    onError: (e) => setNotice({ type: 'error', message: e.message }),
  })
  const markRead = useMutation({
    mutationFn: (id) => useFetchPatch(`/workflow/notifications/${id}/read`, {}, { confirmationHandled: 'technical' }),
    onSuccess: async () => { await Promise.all([notifications.refetch(), summary.refetch()]) },
  })

  const reviewPagination = reviews.data?.pagination || { page: reviewPage, totalPages: 1, total: 0 }
  const reviewRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const rows = reviews.data?.data || []
    if (!needle) return rows
    return rows.filter((row) => [row.review_number, row.entity_label, row.action_label, row.action_key, row.lot_project_name, row.initiated_by_name].some((v) => String(v || '').toLowerCase().includes(needle)))
  }, [reviews.data, search])
  const counts = summary.data?.data || {}
  const refreshAll = async () => { await Promise.all([summary.refetch(), reviews.refetch(), approvals.refetch(), notifications.refetch()]) }

  if (actor.role && !REVIEW_CENTER_ROLES.has(actor.role)) return <Navigate to={`/portal/${actor.role}`} replace />

  return <main className="grid gap-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader icon={FiShield} title={queueCopy.title} description={queueCopy.description} /><button type="button" onClick={refreshAll} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-black text-slate-700"><FiRefreshCw />Refresh</button></div>
    {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)} /> : null}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase text-blue-600">Actionable</p><p className="mt-1 text-3xl font-black text-blue-950">{Number(counts.actionable || 0)}</p></div>
      {isHead ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-600">Protected Approvals</p><p className="mt-1 text-3xl font-black text-amber-950">{counts.protectedCountsAvailable === false ? '—' : Number(counts.pendingProtectedChanges || 0)}</p></div> : null}
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-black uppercase text-violet-600">Unread Internal Alerts</p><p className="mt-1 text-3xl font-black text-violet-950">{counts.notificationCountsAvailable === false ? '—' : Number(counts.unreadNotifications || 0)}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">Your Role</p><p className="mt-2 text-lg font-black text-slate-950">{ROLE_LABELS[actor.role] || titleCase(actor.role)}</p></div>
    </section>

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">{[['reviews','Reviews',FiClock], ...(isHead ? [['approvals','Protected Approvals',FiUserCheck]] : []), ['notifications','Internal Notifications',FiBell]].map(([key,label,Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${tab === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon />{label}</button>)}</div>

      {tab === 'reviews' ? <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2"><label className="relative min-w-[240px] flex-1"><FiSearch className="absolute left-3 top-3.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this page by review, unit, action, project..." className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 font-semibold" /></label><div role="group" aria-label="Which reviews to show" className="inline-flex h-11 rounded-xl border border-slate-300 bg-slate-50 p-1"><button type="button" aria-pressed={reviewScope === 'queue'} onClick={() => { setReviewScope('queue'); setStatus(''); setReviewPage(1) }} className={`rounded-lg px-3 text-sm font-black ${reviewScope === 'queue' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Needs My Action</button><button type="button" aria-pressed={reviewScope === 'history'} onClick={() => { setReviewScope('history'); setReviewPage(1) }} className={`rounded-lg px-3 text-sm font-black ${reviewScope === 'history' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>History &amp; Tracking</button></div><select value={status} onChange={(e) => { setStatus(e.target.value); setReviewPage(1); if (e.target.value) setReviewScope('history') }} className="h-11 rounded-xl border border-slate-300 px-3 font-bold"><option value="">All statuses</option>{['pending_head_review','returned_for_correction','pending_auditor_review','audit_case_open','correction_required','pending_auditor_recheck','closed'].map((item) => <option key={item} value={item}>{reviewStatusLabel(item)}</option>)}</select></div>
        {reviews.isLoading ? <StatusAlert type="loading" message="Loading reviews..." /> : reviewRows.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="px-3 py-3">Review</th><th className="px-3 py-3">Record</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Entered By</th><th className="px-3 py-3">Status</th><th className="px-3 py-3"></th></tr></thead><tbody>{reviewRows.map((row) => <tr key={row.operational_review_id} className="border-b last:border-0"><td className="px-3 py-3"><p className="font-mono font-black text-blue-700">{row.review_number}</p><p className="text-xs font-semibold text-slate-500">{fmtDate(row.created_at)}</p></td><td className="px-3 py-3"><p className="font-black">{row.entity_label || titleCase(row.entity_type)}</p><p className="text-xs font-semibold text-slate-500">{row.action_label || titleCase(row.action_key)}{row.lot_project_name ? `, ${row.lot_project_name}` : ''}</p></td><td className="px-3 py-3 font-bold">{titleCase(row.department)}</td><td className="px-3 py-3"><p className="font-bold">{row.initiated_by_name || `User #${row.initiated_by_user_id}`}</p><p className="text-xs text-slate-500">{ROLE_LABELS[row.initiated_by_role] || titleCase(row.initiated_by_role)}</p></td><td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(row.status)}`}>{reviewStatusLabel(row.status)}</span>{reviewScope === 'history' && row.needs_my_action ? <p className="mt-1 text-xs font-black text-blue-700">Waiting on you</p> : null}</td><td className="px-3 py-3 text-right"><button type="button" onClick={() => navigate(`${actorRoot}/review-center/reviews/${row.operational_review_id}`)} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 font-black text-blue-700">{reviewScope === 'history' && !row.needs_my_action ? 'View' : 'Open'}</button></td></tr>)}</tbody></table></div> : <StatusAlert type="info" message={reviewScope === 'queue' ? (status ? 'Nothing in that status is waiting on you. Open History & Tracking to follow reviews after your step.' : 'Nothing is waiting on you right now. Open History & Tracking to follow reviews after your step.') : 'No reviews match these filters.'} />}
        {reviewPagination.total ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><p className="text-sm font-semibold text-slate-500">Page {reviewPagination.page} of {reviewPagination.totalPages}, {reviewPagination.total} review{reviewPagination.total === 1 ? '' : 's'}</p><div className="flex gap-2"><button type="button" disabled={reviewPage <= 1 || reviews.isFetching} onClick={() => setReviewPage((page) => Math.max(page - 1, 1))} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-700 disabled:opacity-40">Previous</button><button type="button" disabled={reviewPage >= reviewPagination.totalPages || reviews.isFetching} onClick={() => setReviewPage((page) => page + 1)} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-700 disabled:opacity-40">Next</button></div></div> : null}
      </div> : null}

      {tab === 'approvals' && isHead ? <div className="p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-500">{actor.role === 'auditor' ? 'Full approval history, read-only. Approved changes reach your Reviews queue once they are saved.' : 'Head approvals for protected changes.'}</p><label className="flex items-center gap-2 text-sm font-black text-slate-700">Status<select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)} className="h-10 rounded-xl border border-slate-300 px-3 font-semibold">{[['','All'],['pending','Pending'],['approved','Approved, not yet used'],['used','Used'],['rejected','Rejected'],['expired','Expired'],['cancelled','Cancelled']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{approvals.isLoading ? <StatusAlert type="loading" message="Loading approval requests..." /> : (approvals.data?.data || []).length ? <div className="grid gap-3">{approvals.data.data.map((row) => <div key={row.protected_change_request_id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-sm font-black text-blue-700">{row.request_number}</p><p className="mt-1 text-lg font-black">{row.entity_label || titleCase(row.entity_type)}</p><p className="text-sm font-semibold text-slate-500">{titleCase(row.action_key)} · {titleCase(row.department)} · {row.lot_project_name || '—'}</p><p className="mt-2 text-sm text-slate-600"><strong>Reason:</strong> {row.reason}</p><p className="mt-1 text-xs font-semibold text-slate-500">Requested by {row.requested_by_name || `User #${row.requested_by_user_id}`} on {fmtDate(row.created_at)}</p>{row.reviewed_at ? <p className="mt-1 text-xs font-semibold text-slate-500">{row.status === 'rejected' ? 'Rejected' : 'Approved'} by {row.reviewed_by_head_name || `User #${row.reviewed_by_head_user_id}`} on {fmtDate(row.reviewed_at)}{row.head_note ? `. Note: ${row.head_note}` : ''}</p> : null}{row.used_at ? <p className="mt-1 text-xs font-semibold text-emerald-700">Change applied on {fmtDate(row.used_at)}</p> : null}{row.status === 'pending' ? <p className="mt-1 text-xs font-semibold text-amber-700">Expires {fmtDate(row.expires_at)}</p> : null}</div><span className={`rounded-full border px-3 py-1 text-xs font-black ${row.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : row.status === 'rejected' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{titleCase(row.status)}</span></div>{row.status === 'pending' && DEPARTMENT_HEAD_ROLE[row.department] === actor.role ? <div className="mt-4 flex gap-2 border-t pt-4"><button type="button" onClick={() => approvalMutation.mutate({ id: row.protected_change_request_id, decision: 'approve' })} className="h-10 rounded-xl bg-emerald-600 px-4 font-black text-white">Approve Exact Change</button><button type="button" onClick={() => approvalMutation.mutate({ id: row.protected_change_request_id, decision: 'reject' })} className="h-10 rounded-xl bg-red-600 px-4 font-black text-white">Reject</button></div> : null}</div>)}</div> : <StatusAlert type="info" message="No protected change requests are visible to your account." />}</div> : null}

      {tab === 'notifications' ? <div className="p-4 sm:p-5">{notifications.isLoading ? <StatusAlert type="loading" message="Loading notifications..." /> : (notifications.data?.data || []).length ? <div className="grid gap-2">{notifications.data.data.map((row) => <button key={row.internal_notification_id} type="button" onClick={() => { if (!row.read_at) markRead.mutate(row.internal_notification_id); if (row.operational_review_id) navigate(`${actorRoot}/review-center/reviews/${row.operational_review_id}`) }} className={`w-full rounded-2xl border p-4 text-left ${row.read_at ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{row.title}</p><p className="mt-1 text-sm font-semibold text-slate-600">{row.message || ''}</p><p className="mt-2 text-xs font-semibold text-slate-400">{fmtDate(row.created_at)}</p></div>{!row.read_at ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" /> : null}</div></button>)}</div> : <StatusAlert type="info" message="No internal workflow notifications yet." />}</div> : null}
    </section>
  </main>
}

export default ReviewCenter



