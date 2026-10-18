// Expand saved seller-change and manager-replacement Audit Log evidence for export.
// Source of truth is the stored event metadata, never a lookup of live sellers.
const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : ''
const value = x => x === null || x === undefined || x === '' ? 'Not Recorded' : String(x)
const money = x => x === null || x === undefined || x === '' ? 'Not Recorded' : value(x)
const sellerName = row => value(row?.sellerName || row?.full_name || row?.name || row?.accreditedSellerId || row?.sellerId)
const rowRole = row => value(row?.role || row?.commission_role || row?.commissionRole)
export const sellerAuditRows = logs => logs.flatMap(log => {
  const m = log?.metadata || {}
  const review = positiveId(m.reviewId || m.operationalReviewId)
  const common = [log.id,review,log.createdAt,log.title,log.entityLabel || log.entityId]
  if (m.replacementId) {
    const affected = Array.isArray(m.affected) ? m.affected : []
    return (affected.length ? affected : [{}]).map(item => [...common,
      positiveId(m.replacementId),value(item.name || item.fullName || item.sellerId || 'No direct reports'),
      value(m.fromManagerName || m.fromUserId),value(m.toManagerName || m.toUserId),
      '', '', '', '', value(m.reason),value(m.verificationId),
    ])
  }
  if (m.changeId && Array.isArray(m.before) && Array.isArray(m.after)) {
    const before = m.before, after = m.after
    const count = Math.max(before.length,after.length)
    return Array.from({length:count||1},(_,i)=>{
      const old = before[i],next=after[i]
      return [...common,positiveId(m.changeId),rowRole(old || next),
        sellerName(old),sellerName(next),
        value(old?.rate ?? old?.commissionRate),value(next?.rate ?? next?.commissionRate),
        money(old?.grossCommission ?? old?.grossCommissionAmount),money(next?.grossCommission ?? next?.grossCommissionAmount),
        value(m.reason),value(m.authorizationType)]
    })
  }
  return []
})
