/**
 * Bind Network Company Profit only to the exact persisted buyer account.
 * A unit may be resold, so project/unit/customer-name matching is unsafe.
 */
export const selectCompanyProfitsForAccount = (records, accountId) => {
  const id = Number(accountId)
  if (!Number.isSafeInteger(id) || id <= 0) return []
  return (Array.isArray(records) ? records : []).filter(
    (profit) => Number(profit.accountId) === id
  )
}
