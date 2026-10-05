import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  FiAlertTriangle,
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
import useCurrentUser from '../../utils/useCurrentUser'
import { getDoubleCheckNotice, useFetch, useFetchPatch, useFetchPost, useFetchPost as postWorkflow } from '../../utils/useFetch'
import { DEPARTMENT_HEAD_ROLE, ROLE_LABELS } from '../../config/permissions'

const parseJson = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}

const titleCase = (value = '') => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const fmtDate = (value) => value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const statusClass = (status = '') => {
  if (['closed', 'auditor_verified'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (['returned_for_correction', 'audit_case_open', 'correction_required'].includes(status)) return 'bg-red-50 text-red-700 border-red-200'
  if (['pending_auditor_review', 'pending_auditor_recheck'].includes(status)) return 'bg-violet-50 text-violet-700 border-violet-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

const Snapshot = ({ title, value }) => {
  const data = parseJson(value)
  if (!data || typeof data !== 'object') return null
  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {Object.entries(data).map(([key, item]) => <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{titleCase(key)}</p>
        <p className="mt-1 break-words text-sm font-black text-slate-800">{item == null || item === '' ? '—' : typeof item === 'object' ? JSON.stringify(item) : String(item)}</p>
      </div>)}
    </div>
  </section>
}

const TextActionModal = ({ title, label, placeholder, confirmLabel, tone = 'blue', onClose, onConfirm, busy }) => {
  const [text, setText] = useState('')
  const classes = tone === 'red' ? 'bg-red-600 hover:bg-red-700' : tone === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
  return <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4">
    <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 p-5"><div><h3 className="text-xl font-black">{title}</h3><p className="mt-1 text-sm font-semibold text-slate-500">This response becomes part of the immutable review history.</p></div><button type="button" onClick={onClose} disabled={busy} className="rounded-xl border p-2"><FiX /></button></header>
      <div className="p-5"><label className="grid gap-2 text-sm font-black text-slate-700">{label}<textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="rounded-xl border border-slate-300 p-3 font-semibold outline-none focus:border-blue-400" /></label></div>
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
  emergency_super_admin: 'Emergency Super Admin change',
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

const ReviewDetails = ({ reviewId, onClose, onChanged }) => {
  const navigate = useNavigate()
  const { data: me } = useCurrentUser()
  const actor = me?.user || {}
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState(null)
  const query = useQuery({ queryKey: ['workflow-review', reviewId], queryFn: () => useFetch(`/workflow/reviews/${reviewId}`) })
  const review = query.data?.data || null
  const auditCase = review?.auditCase || null
  const isHead = Boolean(review && DEPARTMENT_HEAD_ROLE[review.department] === actor.role)
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
    onSuccess: async (result) => { setNotice({ type: 'success', message: result.message }); setAction(null); await query.refetch(); onChanged?.() },
    onError: (error) => setNotice(getDoubleCheckNotice(error, 'Workflow action failed.')),
  })

  const before = parseJson(review?.before_snapshot_json) || {}
  const after = parseJson(review?.after_snapshot_json) || {}
  const recordListingId = after?.listingId || before?.listingId || null
  const recordPaymentId = after?.paymentId || before?.paymentId || null
  const auditSuffix = auditCase?.audit_case_id ? `&auditCaseId=${auditCase.audit_case_id}` : ''
  const actorRoot = `/portal/${actor.role || 'super_admin'}`
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
  const groupId = Number(after?.groupId || before?.groupId || (review?.entity_type === 'seller_group' ? review?.entity_id : String(review?.entity_id || '').split(':')[0]) || 0) || null
  const groupType = String(after?.groupType || before?.groupType || 'in_house') === 'external' ? 'external' : 'in-house'
  const sellerGroupId = Number(after?.sellerGroupId || before?.sellerGroupId || 0) || null
  const sellerUserId = Number(after?.userId || before?.userId || 0) || null
  const networkLink = groupId
    ? `${actorRoot}/accredited/groups/${groupType}/${groupId}?workflowAction=${workflowAction}&reviewId=${reviewId}${auditSuffix}`
    : null
  const sellerLink = sellerGroupId
    ? `${actorRoot}/accredited/groups/in-house/${sellerGroupId}?workflowAction=seller_edit_review&reviewId=${reviewId}${sellerUserId ? `&sellerId=${sellerUserId}` : ''}${auditSuffix}`
    : `${actorRoot}/accredited?workflowAction=seller_edit_review&reviewId=${reviewId}${auditSuffix}`
  const recordLink = review?.entity_type === 'lot_project_settings' && review?.lot_project_slug
    ? `/portal/lot-projects/${review.lot_project_slug}/settings?workflowAction=project_settings_correction&reviewId=${reviewId}${auditSuffix}`
    : review?.entity_type === 'lot_project_commission' && review?.lot_project_slug
      ? `/portal/lot-projects/${review.lot_project_slug}/commissions?workflowAction=commission_stage_review&reviewId=${reviewId}&commissionId=${review.entity_id}${auditSuffix}`
      : review?.entity_type === 'lot_project_listing_import' && review?.lot_project_slug
        ? `/portal/lot-projects/${review.lot_project_slug}/listings?workflowAction=listing_import_review&reviewId=${reviewId}${auditSuffix}`
        : review?.entity_type === 'lot_project_listing' && reviewActionKey === 'listing.delete' && review?.lot_project_slug
          ? `/portal/lot-projects/${review.lot_project_slug}/listings?workflowAction=listing_delete_review&reviewId=${reviewId}${auditSuffix}`
          : ['seller_group', 'seller_group_project_rates'].includes(review?.entity_type)
            ? networkLink
            : review?.entity_type === 'accredited_seller'
              ? sellerLink
              : workflowAction && review?.lot_project_slug && recordListingId
                ? `/portal/lot-projects/${review.lot_project_slug}/listings/${recordListingId}?workflowAction=${workflowAction}&reviewId=${reviewId}${['lot_project_payment','lot_project_payment_proof','lot_project_signed_receipt'].includes(review?.entity_type) && recordPaymentId ? `&paymentId=${recordPaymentId}` : ''}${['lot_project_penalty_schedule','lot_project_lmf_schedule'].includes(review?.entity_type) ? `&scheduleId=${review.entity_id}` : ''}${auditSuffix}`
                : null
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


  // Correct & Confirm (plan item 15): the Head claims the review, opens the
  // record, and saves the corrected values there. The save folds into this
  // review and sends it to the Auditor.
  const correctAndConfirm = async () => {
    try {
      if (!review.claimed_by_user_id) await postWorkflow(`/workflow/reviews/${reviewId}/claim`, {}, { confirmationHandled: 'technical' })
      onClose()
      navigate(`${recordLink}${recordLink.includes('?') ? '&' : '?'}headCorrection=1`)
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    }
  }
  const responders = auditCase?.responders || null
  const canRespondToCase = auditCase?.status === 'awaiting_head_response' && Boolean(responders?.canRespond)
  const canReassignResponder = auditCase?.status === 'awaiting_head_response' && ['system_admin', 'super_admin'].includes(actor.role)

  if (query.isLoading) return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-xl rounded-3xl bg-white p-5"><StatusAlert type="loading" message="Loading review..." /></div></div>
  if (!review) return null

  return <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/60 p-4">
    <div className="mx-auto my-5 max-w-5xl rounded-3xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-black text-blue-700">{review.review_number}</span><span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(review.status)}`}>{titleCase(review.status)}</span>{review.approval_type ? <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${review.approval_type === 'emergency_super_admin' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{APPROVAL_TYPE_LABELS[review.approval_type] || titleCase(review.approval_type)}</span> : null}</div><h2 className="mt-2 text-2xl font-black">{review.entity_label || titleCase(review.entity_type)}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{titleCase(review.department)} · {titleCase(review.action_key)} · {review.lot_project_name || 'No project scope'}</p></div><button type="button" onClick={onClose} className="rounded-xl border p-2"><FiX /></button></header>
      <div className="grid gap-5 p-5 sm:p-6">
        {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)} /> : null}
        <section className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-3"><div><p className="text-xs font-black uppercase text-slate-400">Entered by</p><p className="mt-1 font-black">{review.initiated_by_name || `User #${review.initiated_by_user_id}`}</p><p className="text-xs font-semibold text-slate-500">{ROLE_LABELS[review.initiated_by_role] || titleCase(review.initiated_by_role)}</p></div><div><p className="text-xs font-black uppercase text-slate-400">Head Review</p><p className="mt-1 font-black">{review.head_reviewed_by_name || 'Pending / not required yet'}</p><p className="text-xs font-semibold text-slate-500">{fmtDate(review.head_reviewed_at)}</p></div><div><p className="text-xs font-black uppercase text-slate-400">Auditor</p><p className="mt-1 font-black">{review.auditor_reviewed_by_name || 'Pending'}</p><p className="text-xs font-semibold text-slate-500">{fmtDate(review.auditor_reviewed_at)}</p></div></section>
        <div className="grid gap-4 lg:grid-cols-2"><Snapshot title="Before" value={review.before_snapshot_json} /><Snapshot title="After" value={review.after_snapshot_json} /></div>
        {auditCase ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wide text-red-600">Audit Case</p><p className="text-lg font-black text-red-950">{auditCase.case_number}</p></div><span className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-black text-red-700">{titleCase(auditCase.status)}</span></div><div className="mt-3 grid gap-3"><div><p className="text-xs font-black uppercase text-red-600">Finding</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.finding}</p></div>{auditCase.head_response ? <div><p className="text-xs font-black uppercase text-red-600">Head Explanation</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.head_response}</p></div> : null}{auditCase.auditor_resolution ? <div><p className="text-xs font-black uppercase text-red-600">Auditor Resolution</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.auditor_resolution}</p></div> : null}{auditCase.correction_summary ? <div><p className="text-xs font-black uppercase text-red-600">System Admin Correction</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-950">{auditCase.correction_summary}</p></div> : null}{responders ? <div><p className="text-xs font-black uppercase text-red-600">Who must answer</p><p className="mt-1 text-sm font-semibold text-red-950">{responders.label}{responders.users?.length ? `: ${responders.users.map((user) => user.full_name).join(', ')}` : ': nobody is available. System Admin must reassign.'}</p></div> : null}</div></section> : null}
        <section className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Review History</p><div className="mt-3 space-y-3">{(review.events || []).map((event) => <div key={event.operational_review_event_id} className="flex gap-3 border-l-2 border-blue-200 pl-3"><div className="min-w-0"><p className="font-black text-slate-800">{titleCase(event.event_type)}</p><p className="text-xs font-semibold text-slate-500">{event.actor_name || ROLE_LABELS[event.actor_role] || 'System'} · {fmtDate(event.created_at)}</p>{event.message ? <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{event.message}</p> : null}</div></div>)}</div></section>

        {isHead && review.status === 'pending_head_review' && !supportsRecordCorrection ? <StatusAlert type="info" message="This action is already completed and has no safe in-place correction endpoint. Open the record for any compensating action, then confirm the review only when the recorded action is accurate." /> : null}
        <section className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          {isHead && review.status === 'pending_head_review' ? <><button type="button" onClick={() => mutation.mutate({ type: 'claim' })} disabled={mutation.isPending} className="h-10 rounded-xl border border-blue-200 bg-blue-50 px-4 font-black text-blue-700"><FiUserCheck className="mr-2 inline" />Claim Review</button><button type="button" onClick={() => mutation.mutate({ type: 'head-confirm' })} disabled={mutation.isPending} className="h-10 rounded-xl bg-emerald-600 px-4 font-black text-white"><FiCheckCircle className="mr-2 inline" />Confirm — No Mistake</button>{supportsRecordCorrection ? <button type="button" onClick={() => setAction('return')} disabled={mutation.isPending} className="h-10 rounded-xl bg-amber-600 px-4 font-black text-white">Return for Correction</button> : null}</> : null}
          {actor.role === 'auditor' && review.status === 'pending_auditor_review' ? <><button type="button" onClick={() => mutation.mutate({ type: 'audit-verify' })} disabled={mutation.isPending} className="h-10 rounded-xl bg-emerald-600 px-4 font-black text-white"><FiCheckCircle className="mr-2 inline" />Verified — No Issue</button><button type="button" onClick={() => setAction('open-case')} disabled={mutation.isPending} className="h-10 rounded-xl bg-red-600 px-4 font-black text-white"><FiAlertTriangle className="mr-2 inline" />Open Audit Case</button></> : null}
          {canRespondToCase ? <button type="button" onClick={() => setAction('head-response')} className="h-10 rounded-xl bg-blue-600 px-4 font-black text-white">Submit Explanation</button> : null}
          {canReassignResponder ? <button type="button" onClick={() => setAction('reassign')} className="h-10 rounded-xl border border-violet-300 bg-violet-50 px-4 font-black text-violet-800">Reassign Responder</button> : null}
          {isHead && review.status === 'pending_head_review' && supportsRecordCorrection && recordLink && (!review.claimed_by_user_id || Number(review.claimed_by_user_id) === Number(actor.id)) ? <button type="button" onClick={correctAndConfirm} className="h-10 rounded-xl border border-blue-300 bg-white px-4 font-black text-blue-700"><FiExternalLink className="mr-2 inline" />Correct &amp; Confirm</button> : null}
          {actor.role === 'auditor' && auditCase?.status === 'under_auditor_review' ? <><button type="button" onClick={() => setAction('resolve-invalid')} className="h-10 rounded-xl border border-emerald-300 bg-emerald-50 px-4 font-black text-emerald-700">Finding Invalid</button><button type="button" onClick={() => setAction('resolve-valid')} className="h-10 rounded-xl bg-red-600 px-4 font-black text-white">Finding Valid</button></> : null}
          {actor.role === 'system_admin' && review.status === 'correction_required' && supportsRecordCorrection && recordLink ? <button type="button" onClick={() => { onClose(); navigate(recordLink) }} className="h-10 rounded-xl bg-violet-700 px-4 font-black text-white"><FiExternalLink className="mr-2 inline" />{recordActionLabel}</button> : null}
          {actor.role === 'auditor' && review.status === 'pending_auditor_recheck' ? <><button type="button" onClick={() => mutation.mutate({ type: 'audit-verify' })} className="h-10 rounded-xl bg-emerald-600 px-4 font-black text-white">Verify Correction & Close</button><button type="button" onClick={() => setAction('recheck-reject')} className="h-10 rounded-xl bg-red-600 px-4 font-black text-white">Correction Still Wrong</button></> : null}
          {recordLink && actor.role !== 'system_admin' ? <button type="button" onClick={() => { onClose(); navigate(recordLink) }} className="h-10 rounded-xl border border-slate-300 px-4 font-black text-slate-700"><FiExternalLink className="mr-2 inline" />Open Record</button> : null}
        </section>
      </div>
    </div>
    {action === 'return' ? <TextActionModal title="Return for Correction" label="What needs to be corrected?" placeholder="Example: Reference ID does not match the deposit slip." confirmLabel="Return to Staff" tone="red" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'return', text })} /> : null}
    {action === 'open-case' ? <TextActionModal title="Open Audit Case" label="Audit finding" placeholder="Describe the exact mismatch or error." confirmLabel="Open Audit Case" tone="red" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'open-case', text })} /> : null}
    {action === 'head-response' ? <TextActionModal title="Explain Audit Finding" label="Explanation" placeholder="Explain why the recorded values are correct, or acknowledge the mistake." confirmLabel="Submit Explanation" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'head-response', text })} /> : null}
    {action === 'resolve-invalid' ? <TextActionModal title="Mark Finding Invalid" label="Auditor resolution" placeholder="Explain why the original record is valid." confirmLabel="Close as Invalid" tone="emerald" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'resolve-case', decision: 'invalid', text })} /> : null}
    {action === 'resolve-valid' ? <TextActionModal title="Mark Finding Valid" label="Required correction" placeholder="Explain exactly what System Admin must correct." confirmLabel="Send to System Admin" tone="red" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'resolve-case', decision: 'valid', text })} /> : null}
    {action === 'reassign' ? <ReassignResponderModal options={auditCase?.headOptions || []} busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={({ userId, reason }) => mutation.mutate({ type: 'reassign', decision: userId, text: reason })} /> : null}
    {action === 'recheck-reject' ? <TextActionModal title="Correction Still Wrong" label="What still needs to be fixed?" placeholder="Describe the remaining error." confirmLabel="Return to System Admin" tone="red" busy={mutation.isPending} onClose={() => setAction(null)} onConfirm={(text) => mutation.mutate({ type: 'audit-recheck-reject', text })} /> : null}
  </div>
}

const ReviewCenter = () => {
  const queryClient = useQueryClient()
  const { data: me } = useCurrentUser()
  const actor = me?.user || {}
  const [tab, setTab] = useState('reviews')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selectedReviewId, setSelectedReviewId] = useState(null)
  const [approvalStatus, setApprovalStatus] = useState('')
  const [notice, setNotice] = useState(null)
  const summary = useQuery({ queryKey: ['workflow-summary'], queryFn: () => useFetch('/workflow/summary'), refetchInterval: 30_000 })
  const reviews = useQuery({ queryKey: ['workflow-reviews', status], queryFn: () => useFetch(`/workflow/reviews?limit=100${status ? `&status=${encodeURIComponent(status)}` : ''}`), enabled: tab === 'reviews' })
  const approvals = useQuery({ queryKey: ['workflow-protected-changes', approvalStatus], queryFn: () => useFetch(`/workflow/protected-changes?limit=100${approvalStatus ? `&status=${encodeURIComponent(approvalStatus)}` : ''}`), enabled: tab === 'approvals' })
  const notifications = useQuery({ queryKey: ['workflow-notifications'], queryFn: () => useFetch('/workflow/notifications?limit=100'), enabled: tab === 'notifications' })
  const approvalMutation = useMutation({
    mutationFn: ({ id, decision }) => useFetchPost(`/workflow/protected-changes/${id}/review`, { decision }, { confirmationHandled: 'compact' }),
    onSuccess: async (result) => { setNotice({ type: 'success', message: result.message }); await Promise.all([approvals.refetch(), summary.refetch()]) },
    onError: (e) => setNotice({ type: 'error', message: e.message }),
  })
  const markRead = useMutation({
    mutationFn: (id) => useFetchPatch(`/workflow/notifications/${id}/read`, {}, { confirmationHandled: 'technical' }),
    onSuccess: async () => { await Promise.all([notifications.refetch(), summary.refetch()]) },
  })

  const reviewRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const rows = reviews.data?.data || []
    if (!needle) return rows
    return rows.filter((row) => [row.review_number, row.entity_label, row.action_key, row.lot_project_name, row.initiated_by_name].some((v) => String(v || '').toLowerCase().includes(needle)))
  }, [reviews.data, search])
  const counts = summary.data?.data || {}
  const refreshAll = async () => { await Promise.all([summary.refetch(), reviews.refetch(), approvals.refetch(), notifications.refetch()]) }

  return <main className="grid gap-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader icon={FiShield} title="Review Center" description="Department double-checks, independent Auditor verification, Audit Cases, and protected change approvals." /><button type="button" onClick={refreshAll} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-black text-slate-700"><FiRefreshCw />Refresh</button></div>
    {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)} /> : null}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase text-blue-600">Actionable</p><p className="mt-1 text-3xl font-black text-blue-950">{Number(counts.actionable || 0)}</p></div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-600">Protected Approvals</p><p className="mt-1 text-3xl font-black text-amber-950">{Number(counts.pendingProtectedChanges || 0)}</p></div>
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-black uppercase text-violet-600">Unread Internal Alerts</p><p className="mt-1 text-3xl font-black text-violet-950">{Number(counts.unreadNotifications || 0)}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">Your Role</p><p className="mt-2 text-lg font-black text-slate-950">{ROLE_LABELS[actor.role] || titleCase(actor.role)}</p></div>
    </section>

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">{[['reviews','Reviews',FiClock],['approvals','Protected Approvals',FiUserCheck],['notifications','Internal Notifications',FiBell]].map(([key,label,Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${tab === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon />{label}</button>)}</div>

      {tab === 'reviews' ? <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2"><label className="relative min-w-[240px] flex-1"><FiSearch className="absolute left-3 top-3.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search review, unit, action, project..." className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 font-semibold" /></label><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-xl border border-slate-300 px-3 font-bold"><option value="">All statuses</option>{['pending_head_review','returned_for_correction','pending_auditor_review','audit_case_open','correction_required','pending_auditor_recheck','closed'].map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></div>
        {reviews.isLoading ? <StatusAlert type="loading" message="Loading reviews..." /> : reviewRows.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="px-3 py-3">Review</th><th className="px-3 py-3">Record</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Entered By</th><th className="px-3 py-3">Status</th><th className="px-3 py-3"></th></tr></thead><tbody>{reviewRows.map((row) => <tr key={row.operational_review_id} className="border-b last:border-0"><td className="px-3 py-3"><p className="font-mono font-black text-blue-700">{row.review_number}</p><p className="text-xs font-semibold text-slate-500">{fmtDate(row.created_at)}</p></td><td className="px-3 py-3"><p className="font-black">{row.entity_label || titleCase(row.entity_type)}</p><p className="text-xs font-semibold text-slate-500">{titleCase(row.action_key)} · {row.lot_project_name || '—'}</p></td><td className="px-3 py-3 font-bold">{titleCase(row.department)}</td><td className="px-3 py-3"><p className="font-bold">{row.initiated_by_name || `User #${row.initiated_by_user_id}`}</p><p className="text-xs text-slate-500">{ROLE_LABELS[row.initiated_by_role] || titleCase(row.initiated_by_role)}</p></td><td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(row.status)}`}>{titleCase(row.status)}</span></td><td className="px-3 py-3 text-right"><button type="button" onClick={() => setSelectedReviewId(row.operational_review_id)} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 font-black text-blue-700">Open</button></td></tr>)}</tbody></table></div> : <StatusAlert type="info" message="No reviews match this queue." />}
      </div> : null}

      {tab === 'approvals' ? <div className="p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-500">{actor.role === 'auditor' ? 'Full approval history, read-only. Approved changes reach your Reviews queue once they are saved.' : 'Head approvals for protected changes.'}</p><label className="flex items-center gap-2 text-sm font-black text-slate-700">Status<select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)} className="h-10 rounded-xl border border-slate-300 px-3 font-semibold">{[['','All'],['pending','Pending'],['approved','Approved, not yet used'],['used','Used'],['rejected','Rejected'],['expired','Expired'],['cancelled','Cancelled']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{approvals.isLoading ? <StatusAlert type="loading" message="Loading approval requests..." /> : (approvals.data?.data || []).length ? <div className="grid gap-3">{approvals.data.data.map((row) => <div key={row.protected_change_request_id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-sm font-black text-blue-700">{row.request_number}</p><p className="mt-1 text-lg font-black">{row.entity_label || titleCase(row.entity_type)}</p><p className="text-sm font-semibold text-slate-500">{titleCase(row.action_key)} · {titleCase(row.department)} · {row.lot_project_name || '—'}</p><p className="mt-2 text-sm text-slate-600"><strong>Reason:</strong> {row.reason}</p><p className="mt-1 text-xs font-semibold text-slate-500">Requested by {row.requested_by_name || `User #${row.requested_by_user_id}`} on {fmtDate(row.created_at)}</p>{row.reviewed_at ? <p className="mt-1 text-xs font-semibold text-slate-500">{row.status === 'rejected' ? 'Rejected' : 'Approved'} by {row.reviewed_by_head_name || `User #${row.reviewed_by_head_user_id}`} on {fmtDate(row.reviewed_at)}{row.head_note ? `. Note: ${row.head_note}` : ''}</p> : null}{row.used_at ? <p className="mt-1 text-xs font-semibold text-emerald-700">Change applied on {fmtDate(row.used_at)}</p> : null}{row.status === 'pending' ? <p className="mt-1 text-xs font-semibold text-amber-700">Expires {fmtDate(row.expires_at)}</p> : null}</div><span className={`rounded-full border px-3 py-1 text-xs font-black ${row.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : row.status === 'rejected' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{titleCase(row.status)}</span></div>{row.status === 'pending' && DEPARTMENT_HEAD_ROLE[row.department] === actor.role ? <div className="mt-4 flex gap-2 border-t pt-4"><button type="button" onClick={() => approvalMutation.mutate({ id: row.protected_change_request_id, decision: 'approve' })} className="h-10 rounded-xl bg-emerald-600 px-4 font-black text-white">Approve Exact Change</button><button type="button" onClick={() => approvalMutation.mutate({ id: row.protected_change_request_id, decision: 'reject' })} className="h-10 rounded-xl bg-red-600 px-4 font-black text-white">Reject</button></div> : null}</div>)}</div> : <StatusAlert type="info" message="No protected change requests are visible to your account." />}</div> : null}

      {tab === 'notifications' ? <div className="p-4 sm:p-5">{notifications.isLoading ? <StatusAlert type="loading" message="Loading notifications..." /> : (notifications.data?.data || []).length ? <div className="grid gap-2">{notifications.data.data.map((row) => <button key={row.internal_notification_id} type="button" onClick={() => { if (!row.read_at) markRead.mutate(row.internal_notification_id); if (row.operational_review_id) { setTab('reviews'); setSelectedReviewId(row.operational_review_id) } }} className={`w-full rounded-2xl border p-4 text-left ${row.read_at ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{row.title}</p><p className="mt-1 text-sm font-semibold text-slate-600">{row.message || ''}</p><p className="mt-2 text-xs font-semibold text-slate-400">{fmtDate(row.created_at)}</p></div>{!row.read_at ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" /> : null}</div></button>)}</div> : <StatusAlert type="info" message="No internal workflow notifications yet." />}</div> : null}
    </section>
    {selectedReviewId ? <ReviewDetails reviewId={selectedReviewId} onClose={() => setSelectedReviewId(null)} onChanged={refreshAll} /> : null}
  </main>
}

export default ReviewCenter
