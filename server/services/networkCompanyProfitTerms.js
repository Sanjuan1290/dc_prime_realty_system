// Immutable company profit release proportions, matching seller milestones.
export const COMPANY_PROFIT_STAGES = Object.freeze([
  ['1st Release', 20, 20], ['2nd Release', 40, 20],
  ['3rd Release', 60, 20], ['4th Release', 75, 15], ['Retention', 100, 25],
]);
export const roundProfitMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
export const splitNetworkProfit = (gross) => {
  const amount = roundProfitMoney(gross);
  const parts = COMPANY_PROFIT_STAGES.map(([stage, triggerPercent, releasePercent]) => ({
    stage, triggerPercent, releasePercent,
    amount: roundProfitMoney(amount * releasePercent / 100),
  }));
  parts[4].amount = roundProfitMoney(amount - parts.slice(0, 4).reduce((sum, part) => sum + part.amount, 0));
  return parts;
};

