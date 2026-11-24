export const unholdAllBlockedReason = (profit, sellers, recipients) => {
  if (['cancelled', 'pending_cancellation', 'deletion_pending'].includes(String(profit.accountStatus).toLowerCase()))
    return 'This buyer account is unavailable for Unhold All.'
  if (!sellers.length || sellers.some(seller => Number(seller.paymentPercent || 0) < 100 || !seller.paymentComplete || !seller.documentsComplete))
    return 'Unhold All requires 100% payment and all required documents to be complete.'
  if (recipients.some(row => !row.stage || !['On Hold', 'Pending', 'Eligible', 'Released'].includes(row.stage.status)))
    return 'A recipient milestone is unavailable. Refresh and review the records.'
  if (recipients.some(row => row.stage?.externalReceiptHoldSourceReleaseId))
    return 'Resolve the required agent receipt before removing this hold.'
  if (!recipients.some(row => row.stage?.status === 'On Hold'))
    return 'This milestone has no remaining holds.'
  return ''
}
