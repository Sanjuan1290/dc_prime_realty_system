const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

export const cleanPaymentNumber = (value) =>
  Number(String(value || '').replace(/[^0-9.-]/g, '')) || 0

export const getRowTotalDue = (row = {}) => {
  const explicitTotal = Number(row.totalDue || 0)
  if (explicitTotal > 0) return roundMoney(explicitTotal)

  return roundMoney(
    Math.max(Number(row.dueAmount || 0) - Number(row.discountAmount || 0), 0) +
      Number(row.interest || 0) +
      Number(row.penalty || 0)
  )
}

export const getRowUnpaidAmount = (row = {}) =>
  roundMoney(Math.max(getRowTotalDue(row) - Number(row.amountPaid || 0), 0))

export const getUnpaidScheduledInterest = (rows = []) => roundMoney(rows.reduce((sum, row) => {
  if (['cancelled', 'paid', 'advance', 'advance payment', 'paid early'].includes(String(row.status || row.schedule_status || '').toLowerCase())) return sum
  const interest = Math.max(Number(row.interest ?? row.interestAmount ?? row.interest_amount ?? 0), 0)
  const paidInterest = row.paidInterestAmount ?? row.paid_interest_amount
  const paid = paidInterest == null
    ? Math.min(Math.max(Number(row.amountPaid || 0) - Number(row.paidPenaltyAmount || 0), 0), interest)
    : Number(paidInterest)
  return sum + Math.max(interest - paid, 0)
}, 0))

export const formatPaymentAmountInput = (value) =>
  Number(value || 0) > 0 ? Number(value).toFixed(2) : ''



