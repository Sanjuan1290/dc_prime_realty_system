/**
 * Walk the live reporting structure for a NEW reservation only.
 * A Division Manager with no parent is a successful terminal node, not a cycle.
 * This never reads, updates, or recalculates existing reservation snapshots.
 */
export const traceSellerReportingChain = async (startSeller, loadParentByUserId) => {
  const chain = [];
  const seen = new Set();
  let current = startSeller;

  while (current) {
    const sellerId = Number(current.accredited_seller_id || 0);
    if (!Number.isSafeInteger(sellerId) || sellerId <= 0) {
      throw new Error('Assigned seller hierarchy includes an invalid seller record. Check Seller Setup.');
    }
    if (seen.has(sellerId)) {
      throw new Error('Seller assignments contain a reporting loop. Check Seller Setup.');
    }
    seen.add(sellerId);
    chain.push(current);

    const parentUserId = Number(current.accredited_seller_reports_under_user_id || 0);
    if (!parentUserId) break;
    current = await loadParentByUserId(parentUserId);
  }

  return chain;
};
