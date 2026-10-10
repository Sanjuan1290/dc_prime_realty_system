// Review Record navigation uses a type VERIFIED by the backend on each GET.
// Historical snapshots are not reliable for the member's current Network.
export const getReviewRecordLink = ({
  review, actorRole, reviewId, auditCaseId, before = {}, after = {}, workflowAction = '',
  recordListingId, recordPaymentId,
} = {}) => {
  if (!review || review.entityExists === false || review.action_key === 'network.delete') return null
  const location = review.recordLocation || {}
  const networkTypeSegment = location.groupType === 'external' ? 'external'
    : location.groupType === 'in_house' ? 'in-house' : null
  const root = `/portal/${actorRole || 'super_admin'}`
  const suffix = auditCaseId ? `&auditCaseId=${encodeURIComponent(auditCaseId)}` : ''
  const params = `workflowAction=${encodeURIComponent(workflowAction)}&reviewId=${encodeURIComponent(reviewId)}${suffix}`
  const type = review.entity_type
  if (['seller_group', 'seller_group_project_rates'].includes(type)) {
    const id = Number(location.groupId || 0)
    if (!id || !networkTypeSegment) return null
    return `${root}/accredited/groups/${networkTypeSegment}/${id}?${params}`
  }
  if (type === 'accredited_seller') {
    // The current DB membership is authoritative; never send an External seller
    // to an In-House route just because the old snapshot omitted the type.
    const groupId = Number(location.sellerGroupId || 0)
    if (!groupId || !networkTypeSegment) return `${root}/accredited?workflowAction=seller_edit_review&reviewId=${encodeURIComponent(reviewId)}${suffix}`
    const sellerUserId = Number(location.sellerUserId || 0)
    return `${root}/accredited/groups/${networkTypeSegment}/${groupId}?workflowAction=seller_edit_review&reviewId=${encodeURIComponent(reviewId)}${sellerUserId ? `&sellerId=${sellerUserId}` : ''}${suffix}`
  }
  const slug = review.lot_project_slug
  const listingId = Number(recordListingId || after?.listingId || before?.listingId || 0)
  const paymentId = Number(recordPaymentId || after?.paymentId || before?.paymentId || 0)
  if (type === 'lot_project_settings' && slug)
    return `/portal/lot-projects/${slug}/settings?workflowAction=project_settings_correction&reviewId=${encodeURIComponent(reviewId)}${suffix}`
  if (type === 'lot_project_commission' && slug)
    return `/portal/lot-projects/${slug}/commissions?workflowAction=commission_stage_review&reviewId=${encodeURIComponent(reviewId)}&commissionId=${encodeURIComponent(review.entity_id)}${suffix}`
  if (type === 'lot_project_listing_import' && slug)
    return `/portal/lot-projects/${slug}/listings?workflowAction=listing_import_review&reviewId=${encodeURIComponent(reviewId)}${suffix}`
  if (type === 'lot_project_listing' && review.action_key === 'listing.delete' && slug)
    return `/portal/lot-projects/${slug}/listings?workflowAction=listing_delete_review&reviewId=${encodeURIComponent(reviewId)}${suffix}`
  if (workflowAction && slug && listingId) {
    const paymentParam = ['lot_project_payment', 'lot_project_payment_proof', 'lot_project_signed_receipt'].includes(type) && paymentId
      ? `&paymentId=${paymentId}` : ''
    const scheduleParam = ['lot_project_penalty_schedule', 'lot_project_lmf_schedule'].includes(type)
      ? `&scheduleId=${encodeURIComponent(review.entity_id)}` : ''
    return `/portal/lot-projects/${slug}/listings/${listingId}?workflowAction=${encodeURIComponent(workflowAction)}&reviewId=${encodeURIComponent(reviewId)}${paymentParam}${scheduleParam}${suffix}`
  }
  return null
}
