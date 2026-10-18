// Review navigation must use the backend-verified current location, not
// identifiers guessed from historical snapshots. Modes never grant permission.
const validId = (value) => {
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
const slugParam = (value) => encodeURIComponent(String(value))
export const getReviewRecordLink = ({
  review, actorRole, reviewId, auditCaseId, workflowAction = '', mode = 'view',
} = {}) => {
  if (!review || review.entityExists === false || review.action_key === 'network.delete') return null
  const location = review.recordLocation || {}
  const params = new URLSearchParams()
  params.set('reviewId', String(reviewId))
  if (auditCaseId) params.set('auditCaseId', String(auditCaseId))
  if (mode === 'view') {
    params.set('reviewView', '1')
    params.set('reviewEntityType', String(review.entity_type || ''))
    params.set('reviewTargetId', String(review.entity_id || ''))
  } else {
    params.set('workflowAction', workflowAction)
  }
  const root = `/portal/${slugParam(actorRole || 'super_admin')}`
  const networkTypeSegment = location.groupType === 'external' ? 'external' : location.groupType === 'in_house' ? 'in-house' : null
  if (location.kind === 'network' || location.kind === 'seller') {
    if (validId(location.projectId)) params.set('project', String(location.projectId))
    if (!validId(location.groupId || location.sellerGroupId) || !networkTypeSegment) return null
    if (location.kind === 'seller') {
      if (!validId(location.sellerUserId) || !validId(location.sellerId)) return null
      params.set('sellerId', String(location.sellerUserId))
      params.set('accreditedSellerId', String(location.sellerId))
      if (mode !== 'view') params.set('workflowAction','seller_edit_review')
    }
    return `${root}/accredited/groups/${networkTypeSegment}/${location.groupId || location.sellerGroupId}?${params}`
  }
  const slug = review.lot_project_slug
  if (!slug) return null
  const encodedSlug = slugParam(slug)
  if (location.kind === 'listing_profile') {
    if (!validId(location.listingId)) return null
    const accountPart = validId(location.accountId) ? `/accounts/${location.accountId}` : ''
    if (location.paymentId) params.set('paymentId', String(location.paymentId))
    if (location.proofId) params.set('proofId', String(location.proofId))
    if (location.scheduleId) params.set('scheduleId', String(location.scheduleId))
    return `/portal/lot-projects/${encodedSlug}/listings/${location.listingId}${accountPart}?${params}`
  }
  if (review.entity_type === 'lot_project_settings')
    return `/portal/lot-projects/${encodedSlug}/settings?${params}`
  if (review.entity_type === 'lot_project_commission') {
    if (!validId(review.entity_id)) return null
    params.set('commissionId', String(review.entity_id))
    return `/portal/lot-projects/${encodedSlug}/commissions?${params}`
  }
  return null
}
