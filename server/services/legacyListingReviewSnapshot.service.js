// Backward-compatible, read-only recovery of listing prices for reviews made
// before the listing.edit Review snapshot included the saved pricing values.
// The authoritative values come from the ORIGINAL edit Audit Log, never from
// the current listing row (which might have changed again after the review).
const parseObject = (value) => {
  if (!value) return null;
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; }
  catch { return null; }
};

const FINANCIAL_KEYS = [
  'installmentPricePerSqm', 'cashPricePerSqm', 'netSellingPrice',
  'legalMiscRate', 'legalMiscAmount', 'tcp', 'reservationFee', 'annualInterestRate',
];
const hasPrices = (snapshot) => FINANCIAL_KEYS.every((key) =>
  Object.prototype.hasOwnProperty.call(snapshot || {}, key));
const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const snapshotMatchesAudit = (snapshot, audit) =>
  ['unitCode', 'status', 'lotType', 'lotAreaSqm'].every((key) =>
    !(key in snapshot) || same(snapshot[key], audit[key]));

export const enrichLegacyListingReviewSnapshots = async (connection, review = {}) => {
  if (review.action_key !== 'listing.edit') return review;
  const revision = Number(review.revision || 1);
  const before = parseObject(review.before_snapshot_json);
  const after = parseObject(review.after_snapshot_json);
  if (!before || !after || (hasPrices(before) && hasPrices(after))) return review;
  // Later revisions may have a newly-captured AFTER price but an original
  // incomplete BEFORE snapshot. Recover only that original baseline. Never
  // substitute an old Audit Log's AFTER values for an unknown later revision.
  if (revision > 1 && !hasPrices(after)) return review;
  const listingId = Number(review.entity_id);
  const actorId = Number(review.initiated_by_user_id);
  if (!Number.isInteger(listingId) || listingId <= 0 || !Number.isInteger(actorId) || actorId <= 0 || !review.created_at) return review;

  // An audit event is inserted in the SAME transaction directly before the
  // operational review is created. Require a tight timeframe, the same editor,
  // the same exact entity, and matching original fields. If ambiguous, show
  // the original snapshot rather than guessing financial history.
  let rows;
  try {
    [rows] = await connection.query(`
      SELECT metadata_json
      FROM audit_logs
      WHERE module='Listings' AND action='update'
        AND entity_type='lot_project_listing' AND entity_id=? AND actor_user_id=?
        AND audit_log_created_at BETWEEN DATE_SUB(?, INTERVAL 30 SECOND) AND DATE_ADD(?, INTERVAL 30 SECOND)
      ORDER BY audit_log_id DESC LIMIT 10`,
    [String(listingId), actorId, review.created_at, review.created_at]);
  } catch {
    return review;
  }
  // A full result page could conceal additional matching audit events.
  if ((rows || []).length >= 10) return review;
  const candidates = (rows || []).map((row) => {
    const metadata = parseObject(row.metadata_json);
    const auditBefore = parseObject(metadata?.before);
    const auditAfter = parseObject(metadata?.after);
    if (!auditBefore || !auditAfter || !hasPrices(auditBefore) || !hasPrices(auditAfter)) return null;
    if (!snapshotMatchesAudit(before, auditBefore) || (revision === 1 && !snapshotMatchesAudit(after, auditAfter))) return null;
    return { auditBefore, auditAfter };
  }).filter(Boolean);
  if (candidates.length !== 1) return review;
  const candidate = candidates[0];
  const extract = (audit) => Object.fromEntries(FINANCIAL_KEYS.map((key) => [key, audit[key]]));
  return {
    ...review,
    before_snapshot_json: { ...before, ...extract(candidate.auditBefore) },
    after_snapshot_json: revision === 1 ? { ...after, ...extract(candidate.auditAfter) } : after,
    snapshotRecoveredFromAuditLog: true,
  };
};
