// Pure display helpers. Monetary amounts come from the server preview;
// this module sums them for display and does not calculate commission rates.
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

export const summarizeSellerChangeRows = (rows = []) => ({
  recipients: rows.length,
  allocatedRate: rows.reduce((sum, row) => sum + Number(row.rate || 0), 0),
  gross: roundMoney(rows.reduce((sum, row) => sum + Number(row.grossCommission || 0), 0)),
})

export const changedSellerRows = (rows = [], comparison = []) => {
  const byRole = new Map(comparison.map((row) => [String(row.role), row]))
  return rows.map((row) => {
    const prior = byRole.get(String(row.role))
    return {
      ...row,
      changed: !prior
        || Number(prior.accreditedSellerId) !== Number(row.accreditedSellerId)
        || Math.abs(Number(prior.rate || 0) - Number(row.rate || 0)) > 0.00005
        || Math.abs(Number(prior.grossCommission || 0) - Number(row.grossCommission || 0)) > 0.005,
    }
  })
}
