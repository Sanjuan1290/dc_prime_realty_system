/**
 * A Network's Company Profit is not a seller's personal income.
 * Group release rows by immutable seller_group_id and recorded payee;
 * absent identity falls back to profit account id rather than merging by name.
 */
export const groupNetworkProfitReceiptRows = (records = []) => {
  const groups = new Map()
  for (const record of Array.isArray(records) ? records : []) {
    const profit = record?.profit || {}
    const stage = record?.stage || {}
    const groupId = Number(profit.sellerGroupId)
    const fallbackId = Number(profit.id)
    const identity = Number.isSafeInteger(groupId) && groupId > 0
      ? `network:${groupId}`
      : `profit:${fallbackId}`
    const payee = String(profit.payee || stage.payeeName || '').trim()
    const key = `${identity}:payee:${payee.toLocaleLowerCase('en')}`
    if (!groups.has(key)) groups.set(key, {
      key, sellerGroupId: groupId || null, network: profit.network || '-',
      payee, records: [], accountIds: new Set(), totalCents: 0,
    })
    const group = groups.get(key)
    const releaseId = Number(stage.id)
    if (!Number.isSafeInteger(releaseId) || releaseId <= 0 || stage.status !== 'Released') continue
    if (group.records.some(({stage: existing}) => Number(existing.id) === releaseId)) continue
    group.records.push(record)
    group.accountIds.add(Number(profit.accountId))
    group.totalCents += Math.round(Number(stage.amount || 0) * 100)
  }
  return [...groups.values()].map((g) => ({
    key: g.key, sellerGroupId: g.sellerGroupId, network: g.network, payee: g.payee,
    records: g.records, propertyCount: g.accountIds.size, releaseCount: g.records.length,
    releasedAmount: g.totalCents / 100,
  })).filter((g) => g.releaseCount > 0).sort((a, b) => a.network.localeCompare(b.network) || a.payee.localeCompare(b.payee))
}

/** One selectable property = one actual buyer account (never unit/name alone). */
export const profitReceiptProperties = (records = []) => {
  const properties = new Map()
  for (const row of records) {
    const id = Number(row?.profit?.accountId)
    if (!Number.isSafeInteger(id) || id <= 0) continue
    if (!properties.has(id)) properties.set(id, { accountId: id, profit: row.profit, records: [] })
    properties.get(id).records.push(row)
  }
  return [...properties.values()].sort((a,b) =>
    String(a.profit.project || '').localeCompare(String(b.profit.project || '')) ||
    String(a.profit.unit || '').localeCompare(String(b.profit.unit || '')))
}

