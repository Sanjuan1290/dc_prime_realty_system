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

// Full Payment covers every unpaid SOA row, including any outstanding
// interest and penalties already reflected in the current schedule.
export const getFullPaymentAmount = (rows = [], reversedPaymentAmount = 0) =>
  roundMoney(
    rows.reduce((sum, row) => sum + getRowUnpaidAmount(row), 0) +
      Math.max(cleanPaymentNumber(reversedPaymentAmount), 0)
  )

export const formatPaymentAmountInput = (value) =>
  Number(value || 0) > 0 ? Number(value).toFixed(2) : ''

