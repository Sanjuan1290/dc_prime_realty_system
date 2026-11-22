const nonNegative = value => Number.isFinite(Number(value)) ? Math.max(Number(value), 0) : 0
const cents = value => Math.round((nonNegative(value) + Number.EPSILON) * 100)

// totalDue comes from the existing schedule calculator, including its discount,
// interest and net penalty adjustments. Only cash allocated to this row is paid.
export const installmentRemainingDue = ({totalDue, amountPaid, status} = {}) =>
  ['cancelled', 'waived'].includes(String(status || '').toLowerCase()) ? 0 : Math.max(cents(totalDue) - cents(amountPaid), 0) / 100

// released is the reconciled, successfully released cash amount, never the
// eligible amount, buyer payment percentage, or unreleased retention.
export const commissionPaymentProgress = ({entitlement, released} = {}) => {
  const total = nonNegative(entitlement), paid = nonNegative(released)
  const percent = total > 0 ? Math.round((paid / total) * 10000) / 100 : 0
  return {total, paid, percent, barPercent: Math.min(percent, 100)}
}
