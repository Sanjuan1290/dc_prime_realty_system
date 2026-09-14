const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const roundMoney = (value) => Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
const clean = (value) => String(value ?? '').trim();
const dateOnly = (value) => value ? String(value).slice(0, 10) : null;

const paymentWithinCutoff = (payment, cutoffDate = null) => {
  if (!cutoffDate) return true;
  const paymentDate = dateOnly(payment.lot_project_payment_date);
  return Boolean(paymentDate && paymentDate <= cutoffDate);
};

/**
 * Canonical commission payment-progress calculation.
 *
 * Recognizes verified cash plus only the earned portion of the approved DP
 * discount. Sale discounts, reservation credits, and LMF adjustments are
 * already reflected in the computed SOA terms and therefore are not counted a
 * second time as cash.
 */
export const calculateCommissionPaymentProgress = ({
  terms = {},
  payments = [],
  cutoffDate = null,
  forceFullyPaid = false,
} = {}) => {
  const approvedDpDiscount = roundMoney(terms.downpaymentDiscountTotal);
  const remainingDpCash = roundMoney(terms.downpaymentTotal);

  const verifiedPayments = payments
    .filter((payment) => clean(payment.lot_project_payment_status).toLowerCase() === 'verified')
    .filter((payment) => paymentWithinCutoff(payment, cutoffDate));

  const verifiedCash = roundMoney(
    verifiedPayments.reduce((sum, payment) => sum + toNumber(payment.lot_project_payment_amount), 0)
  );

  const downpaymentPaid = roundMoney(
    verifiedPayments
      .filter((payment) => ['downpayment', 'down_payment'].includes(clean(payment.lot_project_payment_type).toLowerCase()))
      .reduce((sum, payment) => sum + toNumber(payment.lot_project_payment_amount), 0)
  );

  const earnedDpDiscount = approvedDpDiscount <= 0
    ? 0
    : remainingDpCash <= 0
      ? approvedDpDiscount
      : roundMoney(Math.min(
          approvedDpDiscount,
          approvedDpDiscount * (downpaymentPaid / remainingDpCash)
        ));

  const tcp = roundMoney(terms.tcp);
  const calculatedSettledValue = roundMoney(Math.min(verifiedCash + earnedDpDiscount, tcp));
  const settledValue = forceFullyPaid && tcp > 0 ? tcp : calculatedSettledValue;
  const paymentPercent = forceFullyPaid
    ? 100
    : tcp <= 0
      ? 0
      : Math.min(100, roundMoney((settledValue / tcp) * 100));
  const remainingBalance = forceFullyPaid ? 0 : roundMoney(Math.max(tcp - settledValue, 0));

  return {
    tcp,
    verifiedCash,
    downpaymentPaid,
    approvedDpDiscount,
    earnedDpDiscount,
    settledValue,
    paymentPercent,
    remainingBalance,
    paymentComplete: paymentPercent >= 100 || remainingBalance <= 0.009,
  };
};
