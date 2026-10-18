// Exact, read-only previews for Review Center actions without a dedicated
// live form. All identifiers originate from the saved review and each query
// enforces the review's project/Network relationship. No untrusted SQL names.
const validId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const parseSnapshot = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try { const obj = JSON.parse(value); return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}; }
  catch { return {}; }
};
// Nested spouse/co-buyer objects can contain sensitive or technical keys.
// Do not send secrets merely because a reviewer may inspect the form.
const isSafeField = (key) => !/password|passcode|secret|token|otp|cookie|authorization|private|signature|pin|tin_?no|account_?number|bank_?account/i.test(key);
const safeFormValue = (value, depth = 0) => {
  if (depth > 5) return 'Additional details not displayed';
  if (Array.isArray(value)) return value.slice(0, 30).map(item => safeFormValue(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => isSafeField(key))
    .slice(0, 80)
    .map(([key, item]) => [key, safeFormValue(item, depth + 1)]));
  return value;
};
const unreachable = (message = 'The original record is no longer available. Its saved Before & After details are still here.') => ({
  available: false, message,
});
const pageNumber = (value) => Math.min(10000, Math.max(1, Math.trunc(Number(value) || 1)));
const limitedList = async (connection, sql, params, page) => {
  const limit = 25;
  const [rows] = await connection.query(sql, [...params, limit + 1, (page - 1) * limit]);
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit, page };
};
export const supportedReviewExtraTypes = Object.freeze([
  'lot_project_buyer_form', 'lot_project_listing_import',
  'lot_project_network_profit_release', 'network_member_import',
]);
export const isExtraRecordPreview = (review) => supportedReviewExtraTypes.includes(String(review?.entity_type || ''))
  || ['network.members.import','network.members.import.undo'].includes(String(review?.action_key || ''));

export async function getReviewExtraRecord(connection, review, requestedPage = 1) {
  if (!isExtraRecordPreview(review)) return { supported: false };
  const type = String(review.entity_type || '');
  const after = parseSnapshot(review.after_snapshot_json);
  const before = parseSnapshot(review.before_snapshot_json);
  const entityId = validId(String(review.entity_id || '').split(':')[0]);
  const projectId = validId(review.lot_project_id);
  const page = pageNumber(requestedPage);
  if (type === 'lot_project_buyer_form') {
    const submissionId = entityId || validId(after.submissionId) || validId(before.submissionId);
    if (!submissionId || !projectId) return unreachable();
    const [rows] = await connection.query(`
      SELECT lot_project_buyer_form_submission_id AS id, lot_project_id AS projectId,
        lot_project_listing_id AS listingId, lot_project_account_id AS accountId,
        buyer_full_name AS buyerName, buyer_email AS email,
        buyer_contact_number AS contactNo, buyer_type AS buyerType,
        submission_status AS status, submitted_at AS submittedAt,
        reviewed_at AS reviewedAt, rejection_reason AS rejectionReason,
        submitted_payload_json AS savedForm
      FROM lot_project_buyer_form_submissions
      WHERE lot_project_buyer_form_submission_id=? AND lot_project_id=? LIMIT 1`, [submissionId, projectId]);
    if (!rows.length) return unreachable('This buyer form is no longer available. Its saved review is still here.');
    if (validId(after.listingId || before.listingId) && validId(after.listingId || before.listingId) !== Number(rows[0].listingId)) return unreachable();
    const {savedForm, ...fields} = rows[0];
    // Never expose raw token/link hashes or network request metadata.
    const raw = parseSnapshot(savedForm);
    const visibleKeys = [
      'buyerName','buyerType','firstName','middleName','lastName','email','contactNo',
      'presentAddress','permanentAddress','birthDate','birthPlace','civilStatus',
      'nationality','occupationPositionTitle','monthlyIncome','spouse','coBuyers'
    ];
    const form = safeFormValue(Object.fromEntries(visibleKeys.filter((key) => Object.hasOwn(raw,key)).map((key) => [key,raw[key]])));
    return {supported:true,available:true,type, title:'Buyer Form', fields, form};
  }
  if (type === 'lot_project_listing_import') {
    const batchId = entityId || validId(after.batchId) || validId(before.batchId);
    if (!batchId || !projectId) return unreachable();
    const [batches] = await connection.query(`
      SELECT lot_project_listing_import_batch_id AS id, batch_reference AS reference,
        original_filename AS filename, total_rows AS totalRows, imported_rows AS importedRows,
        removed_rows AS removedRows, import_status AS status, imported_at AS importedAt
      FROM lot_project_listing_import_batches
      WHERE lot_project_listing_import_batch_id=? AND lot_project_id=? LIMIT 1`, [batchId, projectId]);
    if (!batches.length) return unreachable('This import batch is no longer available. Its saved review is still here.');
    const entries = await limitedList(connection, `
      SELECT excel_row_number AS row, unit_id_snapshot AS unit,
        validation_status AS status, lot_project_listing_id AS listingId
      FROM lot_project_listing_import_rows WHERE lot_project_listing_import_batch_id=?
      ORDER BY excel_row_number ASC LIMIT ? OFFSET ?`, [batchId], page);
    return {supported:true,available:true,type,title:'Listing Import', fields:batches[0], entries};
  }
  if (type === 'lot_project_network_profit_release') {
    if (!entityId || !projectId) return unreachable();
    const [rows] = await connection.query(`
      SELECT r.id, r.release_stage AS stage, r.release_status AS status,
        r.release_percent AS percent, r.release_amount AS amount,
        r.actual_release_date AS releaseDate, r.payee_name AS payee,
        r.payment_method AS paymentMethod, r.payment_reference AS paymentReference,
        p.network_name_snapshot AS network, p.lot_project_account_id AS accountId,
        p.lot_project_listing_id AS listingId
      FROM lot_project_network_profit_releases r
      INNER JOIN lot_project_network_profit_accounts p ON p.id=r.profit_account_id
      WHERE r.id=? AND p.lot_project_id=? LIMIT 1`, [entityId, projectId]);
    if (!rows.length) return unreachable('This profit release is no longer available. Its saved review is still here.');
    return {supported:true,available:true,type,title:'Network Profit Release',fields:rows[0]};
  }
  if (['network.members.import','network.members.import.undo'].includes(review.action_key) || type === 'network_member_import') {
    const groupId = validId(after.groupId || before.groupId || review.entity_id);
    const batchId = validId(after.importBatchId || after.batchId || before.importBatchId || before.batchId);
    if (!groupId || !batchId) return unreachable();
    const [batches] = await connection.query(`
      SELECT batch_id AS id, seller_group_id AS networkId, member_count AS memberCount,
        status, imported_at AS importedAt
      FROM network_member_import_batches WHERE batch_id=? AND seller_group_id=? LIMIT 1`,[batchId, groupId]);
    if (!batches.length) return unreachable('This member import is no longer available. Its saved review is still here.');
    const entries = await limitedList(connection, `
      SELECT source_row AS row, member_email AS member, import_action AS action
      FROM network_member_import_items WHERE batch_id=?
      ORDER BY source_row ASC LIMIT ? OFFSET ?`,[batchId],page);
    return {supported:true,available:true,type:'network_member_import',title:'Seller Import',fields:batches[0],entries};
  }
  return {supported:false};
}
