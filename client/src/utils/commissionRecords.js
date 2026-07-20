const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const roleOrder = {
  agent: 1,
  manager: 2,
  broker: 3,
  broker_network_manager: 4,
}

const sellerSortValue = (seller = {}) => {
  const commissionType = String(seller.commissionType || '').toLowerCase()
  const role = String(seller.rawRole || '').toLowerCase()
  return (commissionType === 'direct' ? 0 : 10) + (roleOrder[role] || 99)
}

const uniqueLabels = (values = []) => [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))]

/**
 * Groups database commission lines into one record per buyer account.
 * A unit can be sold to several buyers over time, so client profile/account IDs
 * take priority over the listing ID when building the grouping key.
 */
export const groupCommissionRecords = (records = []) => {
  const grouped = new Map()

  records.forEach((record) => {
    const listingId = Number(record.listingId || record.lotProjectListingId || 0)
    const clientProfileId = Number(record.clientProfileId || record.lotProjectClientProfileId || 0)
    const accountId = Number(record.accountId || record.lotProjectAccountId || 0)
    const fallbackKey = `${record.project || ''}|${record.unit || ''}|${record.client || ''}`
    const key = accountId
      ? `account-${accountId}`
      : clientProfileId
        ? `profile-${clientProfileId}`
        : listingId
          ? `listing-${listingId}`
          : fallbackKey

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key,
        listingId,
        accountId,
        clientProfileId,
        unit: record.unit || '-',
        client: record.client || 'No buyer name',
        project: record.project || '-',
        commissionBase: toNumber(record.commissionBase),
        tcp: toNumber(record.tcp),
        paid: toNumber(record.paid),
        paymentPercent: toNumber(record.paymentPercent),
        sellers: [],
        grossCommission: 0,
        released: 0,
        eligibleToRelease: 0,
        cashAdvanceDeduction: 0,
        netRemaining: 0,
      })
    }

    const account = grouped.get(key)
    account.sellers.push(record)
    account.grossCommission += toNumber(record.grossCommission)
    account.released += toNumber(record.released)
    account.eligibleToRelease += toNumber(record.eligibleToRelease)
    account.cashAdvanceDeduction += toNumber(record.cashAdvanceDeduction)
    account.netRemaining += toNumber(record.netRemaining)
  })

  return [...grouped.values()].map((account) => {
    const sellers = [...account.sellers].sort((a, b) => {
      const roleDifference = sellerSortValue(a) - sellerSortValue(b)
      if (roleDifference !== 0) return roleDifference
      return String(a.seller || '').localeCompare(String(b.seller || ''))
    })

    const sellerGroups = uniqueLabels(sellers.map((seller) => seller.sellerGroup).filter((name) => name !== '-'))
    const commissionTypes = uniqueLabels(sellers.map((seller) => seller.commissionType))

    return {
      ...account,
      sellers,
      sellerCount: sellers.length,
      sellerGroups,
      sellerGroupLabel: sellerGroups.length ? sellerGroups.join(', ') : '-',
      commissionTypes,
      grossCommission: Number(account.grossCommission.toFixed(2)),
      released: Number(account.released.toFixed(2)),
      eligibleToRelease: Number(account.eligibleToRelease.toFixed(2)),
      cashAdvanceDeduction: Number(account.cashAdvanceDeduction.toFixed(2)),
      netRemaining: Number(account.netRemaining.toFixed(2)),
    }
  })
}
