const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const roleOrder = {
  external_group: 0,
  sales_agent: 1,
  unit_manager: 2,
  sales_director: 3,
  division_manager: 4,
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
        isHistoricalAccount: Boolean(record.isHistoricalAccount),
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
    account.isHistoricalAccount = account.isHistoricalAccount || Boolean(record.isHistoricalAccount)
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





/**
 * Display-only combined totals. Seller commission records remain unchanged and
 * Network Company Profit continues to use its separate approval/release ledger.
 * Link by persisted buyer ACCOUNT ID, never by unit ID, name, or listing ID.
 */
export const includeCompanyProfitInCommissionGroups = (groups = [], profits = []) => {
  const byAccount = new Map()
  const seenProfitIds = new Set()
  const cents = (value) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.round(number * 100) : 0
  }

  for (const profit of Array.isArray(profits) ? profits : []) {
    const accountId = Number(profit.accountId)
    const profitId = Number(profit.id)
    if (!Number.isSafeInteger(accountId) || accountId <= 0
        || !Number.isSafeInteger(profitId) || profitId <= 0 || seenProfitIds.has(profitId)) continue
    seenProfitIds.add(profitId)
    const current = byAccount.get(accountId) || { gross: 0, released: 0, eligible: 0 }
    current.gross += cents(profit.totalProfit)
    current.released += cents(profit.released)
    current.eligible += (Array.isArray(profit.stages) ? profit.stages : [])
      .filter((stage) => stage.status === 'Pending' && stage.canRelease === true)
      .reduce((total, stage) => total + cents(stage.amount), 0)
    byAccount.set(accountId, current)
  }

  return groups.map((group) => {
    const accountId = Number(group.accountId)
    const profit = Number.isSafeInteger(accountId) && accountId > 0 ? byAccount.get(accountId) : null
    const sellerGross = cents(group.grossCommission)
    const sellerReleased = cents(group.released)
    const sellerEligible = cents(group.eligibleToRelease)
    const sellerRemaining = cents(group.netRemaining)
    const companyGross = profit?.gross || 0
    const companyReleased = profit?.released || 0
    const companyEligible = profit?.eligible || 0
    const companyRemaining = Math.max(0, companyGross - companyReleased)
    return {
      ...group,
      // Preserve seller-only amounts for visible breakdown and audit checks.
      sellerGrossCommission: sellerGross / 100,
      sellerReleased: sellerReleased / 100,
      sellerEligibleToRelease: sellerEligible / 100,
      sellerNetRemaining: sellerRemaining / 100,
      companyProfitGross: companyGross / 100,
      companyProfitReleased: companyReleased / 100,
      companyProfitEligibleToRelease: companyEligible / 100,
      companyProfitRemaining: companyRemaining / 100,
      hasCompanyProfit: companyGross > 0,
      // Combined display totals, not changes to either source ledger.
      grossCommission: (sellerGross + companyGross) / 100,
      released: (sellerReleased + companyReleased) / 100,
      eligibleToRelease: (sellerEligible + companyEligible) / 100,
      netRemaining: (sellerRemaining + companyRemaining) / 100,
    }
  })
}

