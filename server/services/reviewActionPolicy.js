// Financial beneficiary and manager ownership changes always create a separate
// review entry, even if the same person edited the same record moments earlier.
const distinct = new Set([
  'commission.assigned_seller_change',
  'commission.adjust_unit',
  'seller.manager_replace',
]);
export const requiresDistinctReview = actionKey => distinct.has(String(actionKey || ''));
