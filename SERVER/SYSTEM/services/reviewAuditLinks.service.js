// Link Audit Log entries to a Review using recorded, immutable source IDs.
// The Review ID is the primary link. Some older operations did not save it
// in audit metadata; those have carefully scoped source-specific fallbacks.
const safeId = (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
const snapshot = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
};

export const buildReviewAuditFilter = (review, events = []) => {
  const reviewId = safeId(review?.operational_review_id);
  if (!reviewId) throw new Error('Invalid Review ID.');
  const conditions = ["JSON_UNQUOTE(JSON_EXTRACT(al.metadata_json, '$.reviewId')) = ?"];
  const values = [String(reviewId)];
  const action = String(review.action_key || '');
  const after = snapshot(review.after_snapshot_json);
  const before = snapshot(review.before_snapshot_json);
  const entityId = safeId(String(review.entity_id || '').split(':')[0]);

  // Import audit records used import_batch_id and seller_group_id, not reviewId.
  // Both IDs must match: another batch on the same Network is NOT this Review.
  if (action === 'network.members.import') {
    const groupId = safeId(after.groupId || before.groupId);
    const batchId = safeId(after.importBatchId || after.batchId);
    if (groupId && batchId && groupId === entityId) {
      conditions.push("(al.entity_type = 'seller_network_member_import' AND al.entity_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(al.metadata_json, '$.import_batch_id')) = ?)");
      values.push(String(groupId), String(batchId));
    }
    // Review was originally a Network creation and was later updated in place
    // by this exact import. Include the original creation, but not later changes.
    const createdFromNetwork = events.some(event => String(event.event_type) === 'created' && /^Network creation saved\b/i.test(String(event.message || '')));
    if (createdFromNetwork && entityId && String(review.entity_type) === 'seller_group') {
      conditions.push("(al.module = 'Groups' AND al.action = 'create' AND al.entity_type = 'seller_group' AND al.entity_id = ? AND al.title = 'Created In-House Network')");
      values.push(String(entityId));
    }
  }
  // Older seller creation logs were written before the review existed.
  // Only the accreditation event for the exact seller is safely attributable.
  if (action === 'seller.create' && entityId && String(review.entity_type) === 'accredited_seller') {
    conditions.push("(al.module = 'Accreditation' AND al.action = 'create' AND al.entity_type = 'accredited_seller' AND al.entity_id = ? AND al.title = 'Accredited seller')");
    values.push(String(entityId));
  }
  return { sql: `(${conditions.join(' OR ')})`, values };
};

