import { db } from '../../db/connect.js';
import { DEPARTMENT_HEAD_ROLE, DEPARTMENT_STAFF_ROLES, getRoleDepartment, PERMISSIONS, roleHasPermission } from '../../config/permissions.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { activeNotificationSql, createInternalNotifications, notifyDepartmentHeads, notifyAuditors, REVIEW_ACTION_NOTIFICATION_STAGES } from '../../services/internalNotification.service.js';
import { appendReviewEvent, canActorSeeReview, getOperationalReviewForUpdate } from '../../services/operationalReview.service.js';
import { approveProtectedChange } from '../../services/protectedChange.service.js';
import { notifyCorrectionOwners, resolveAuditCaseWithNotes } from '../../services/auditCaseWorkflow.service.js';
import { getAuditCorrectionRole } from '../../services/auditCaseAuthorization.service.js';
import { getReviewActionLabel, REVIEW_ACTIONS } from '../../config/reviewActions.js';
import { resolveReviewRecordLocation } from '../../services/reviewRecordLocation.service.js';
import { getReviewExtraRecord, isExtraRecordPreview } from '../../services/reviewExtraRecord.service.js';
import { countWorkflowSummaryNotifications } from '../../services/workflowSummaryNotifications.service.js';
import { markVisibleInternalNotificationsRead } from '../../services/internalNotificationRead.service.js';
import { enrichLegacyListingReviewSnapshots } from '../../services/legacyListingReviewSnapshot.service.js';
import { sendAuthenticatedAssetContent } from '../../services/secureCloudinary.service.js';

const errorMessage = (error) => error?.message || 'Workflow operation failed.';
const pageValues = (query = {}) => ({ page: Math.max(Number(query.page || 1),1), limit: Math.min(Math.max(Number(query.limit || 25),1),100) });
// Keep diagnostic information server-side. Never expose SQL or database error
// messages in API responses (the browser does not need database internals).
const logWorkflowSummaryError = (stage, error, actor) => console.error('[workflow/summary]', {
  stage,
  role: String(actor?.role || 'unknown'),
  code: error?.code || null,
  errno: error?.errno || null,
  sqlState: error?.sqlState || null,
  message: error?.message || 'Unknown database error',
});

const reviewQueueWhere = (actor, { alias = 'r' } = {}) => {
  const role = String(actor?.role || '');
  const actorId = Number(actor?.id || 0);
  if (role === 'auditor') return { sql: `${alias}.status='pending_auditor_review'`, params: [] };
  if (['system_admin','super_admin'].includes(role)) return {
    sql: `${alias}.status='correction_required' AND ${role === 'system_admin' ? 'NOT ' : ''}(COALESCE(${alias}.approval_type,'')='emergency_super_admin' OR ${alias}.initiated_by_role='super_admin')`, params: [],
  };
  if (DEPARTMENT_STAFF_ROLES.includes(role)) return { sql: `${alias}.status='returned_for_correction' AND ${alias}.initiated_by_user_id=?`, params: [actorId] };
  const department = getRoleDepartment(actor);
  if (!department || DEPARTMENT_HEAD_ROLE[department] !== role) return { sql: '1=0', params: [] };
  return {
    sql: `${alias}.department=? AND ${alias}.status='pending_head_review'
      AND (${alias}.lot_project_id IS NULL OR COALESCE(?,0)=1 OR EXISTS (SELECT 1 FROM user_project_access wupa WHERE wupa.user_id=? AND wupa.lot_project_id=${alias}.lot_project_id))`,
    params: [department, Number(actor?.all_projects_access || actor?.admin_all_projects || 0), actorId],
  };
};

const canActorOpenReview = async (connection, actor, review) => {
  if (!actor || !review) return false;
  if (actor.role === 'auditor') return review.status === 'pending_auditor_review';
  if (['system_admin','super_admin'].includes(actor.role)) return review.status === 'correction_required' && actor.role === getAuditCorrectionRole(review)
    && roleHasPermission(actor, PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY);
  if (DEPARTMENT_STAFF_ROLES.includes(actor.role)) return review.status === 'returned_for_correction'
    && Number(review.initiated_by_user_id) === Number(actor.id) && await canActorSeeReview(connection, actor, review);
  const department = getRoleDepartment(actor);
  return Boolean(department && DEPARTMENT_HEAD_ROLE[department] === actor.role && review.department === department
    && review.status === 'pending_head_review' && await canActorSeeReview(connection, actor, review));
};

// Read-only access. Anyone who could act on a Review at any stage, or who took
// part in it, can still open it afterwards to see what happened. Acting is
// still limited by canActorOpenReview() and by each action endpoint.
const canActorViewReview = async (connection, actor, review) => {
  if (!actor || !review) return false;
  // Same visibility rules as the History list, so anything listed there opens.
  const history = reviewHistoryWhere(actor);
  const [historyRows] = await connection.query(
    `SELECT 1 FROM operational_reviews r WHERE r.operational_review_id=? AND ${history.sql} LIMIT 1`,
    [review.operational_review_id, ...history.params]
  ).catch(() => [[]]);
  if (historyRows?.length) return true;
  const actorId = Number(actor.id || 0);
  if (!actorId) return false;
  const participants = [review.initiated_by_user_id, review.claimed_by_user_id, review.head_reviewed_by_user_id, review.auditor_reviewed_by_user_id].map(Number);
  if (participants.includes(actorId)) return true;
  const [rows] = await connection.query(
    `SELECT 1 FROM audit_cases WHERE operational_review_id=? AND (assigned_responder_user_id=? OR head_responded_by_user_id=? OR system_admin_user_id=?) LIMIT 1`,
    [review.operational_review_id, actorId, actorId, actorId]
  ).catch(() => [[]]);
  return Boolean(rows?.length);
};

// History visibility scope (read-only). Lets a Head or Auditor keep following a
// review after their own step is done, without it staying in Needs My Action.
//   Auditor:            everything that reached the audit stage
//   System/Super Admin: every review
//   Department Head:    their department, within their project access
//   Anyone else:        reviews they entered
const AUDIT_STAGE_STATUSES = ['pending_auditor_review', 'audit_case_open', 'correction_required', 'pending_auditor_recheck', 'closed', 'auditor_verified'];
const reviewHistoryWhere = (actor, { alias = 'r' } = {}) => {
  const role = String(actor?.role || '');
  const actorId = Number(actor?.id || 0);
  if (role === 'auditor') {
    return {
      sql: `((${alias}.head_reviewed_at IS NOT NULL AND ${alias}.status NOT IN ('pending_head_review','returned_for_correction')) OR ${alias}.status IN (${AUDIT_STAGE_STATUSES.map((status) => `'${status}'`).join(',')}))`,
      params: [],
    };
  }
  if (['system_admin', 'super_admin'].includes(role)) return { sql: '1=1', params: [] };
  const department = getRoleDepartment(actor);
  const isHead = department && DEPARTMENT_HEAD_ROLE[department] === role;
  if (isHead) {
    return {
      sql: `(${alias}.department = ?
        AND (${alias}.lot_project_id IS NULL OR COALESCE(?,0)=1 OR EXISTS (SELECT 1 FROM user_project_access hupa WHERE hupa.user_id=? AND hupa.lot_project_id=${alias}.lot_project_id)))`,
      params: [department, Number(actor?.all_projects_access || actor?.admin_all_projects || 0), actorId],
    };
  }
  return { sql: `${alias}.initiated_by_user_id = ?`, params: [actorId] };
};

// Internal Notifications shown to an account. Action notifications (do this
// review now) appear only while that review is still in this account's own
// queue: once someone else acts, or it is reassigned, it disappears for
// everyone else. Informational notifications always stay.
const QUEUE_GATED_NOTIFICATION_TYPES = Object.keys(REVIEW_ACTION_NOTIFICATION_STAGES);
const notificationVisibilityWhere = (actor, { reviewAlias = 'nr' } = {}) => {
  const queue = reviewQueueWhere(actor, { alias: reviewAlias });
  return {
    join: `LEFT JOIN operational_reviews nr ON nr.operational_review_id=n.operational_review_id`,
    sql: `(${activeNotificationSql('n')}
      AND (
        n.operational_review_id IS NULL
        OR n.notification_type NOT IN (${QUEUE_GATED_NOTIFICATION_TYPES.map((type) => `'${type}'`).join(',')})
        OR (${reviewAlias}.operational_review_id IS NOT NULL AND ${queue.sql})
      ))`,
    params: queue.params,
  };
};

// Returns names for ids found in review snapshots so the Review Center can show
// "Bailen Project" or "Juan Dela Cruz" instead of raw keys and numbers.
const ID_LOOKUP_RULES = [
  { kind: 'project', test: (key) => /^(projectId|lotProjectId|lot_project_id|project_id)$/.test(key) },
  { kind: 'listing', test: (key) => /^(listingId|lot_project_listing_id|listing_id)$/.test(key) },
  { kind: 'document', test: (key) => /^(documentId|document_id)$/.test(key) },
  { kind: 'group', test: (key) => /^(groupId|sellerGroupId|seller_group_id|networkId)$/.test(key) },
  { kind: 'seller', test: (key) => /(SellerId|seller_id)$/i.test(key) && !/user/i.test(key) },
  { kind: 'user', test: (key) => /(^userId$|UserId$|user_id$)/.test(key) },
];

const collectSnapshotIds = (value, bucket) => {
  if (Array.isArray(value)) { value.forEach((item) => collectSnapshotIds(item, bucket)); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    const rule = ID_LOOKUP_RULES.find((entry) => entry.test(key));
    if (rule) {
      const ids = (Array.isArray(item) ? item : [item]).map(Number).filter((id) => Number.isInteger(id) && id > 0);
      ids.forEach((id) => bucket[rule.kind].add(id));
    }
    if (item && typeof item === 'object') collectSnapshotIds(item, bucket);
  }
};

const parseSnapshot = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
};

const buildReviewLookups = async (connection, review) => {
  const bucket = { project: new Set(), listing: new Set(), document: new Set(), group: new Set(), seller: new Set(), user: new Set() };
  collectSnapshotIds(parseSnapshot(review.before_snapshot_json), bucket);
  collectSnapshotIds(parseSnapshot(review.after_snapshot_json), bucket);
  const lookups = { project: {}, listing: {}, document: {}, group: {}, seller: {}, user: {} };
  const load = async (kind, sql) => {
    const ids = [...bucket[kind]].slice(0, 200);
    if (!ids.length) return;
    const [rows] = await connection.query(sql.replace('(?)', `(${ids.map(() => '?').join(',')})`), ids).catch(() => [[]]);
    for (const row of rows || []) lookups[kind][String(row.id)] = row.label;
  };
  await load('project', `SELECT lot_project_id id, lot_project_name label FROM lot_projects WHERE lot_project_id IN (?)`);
  await load('listing', `SELECT lot_project_listing_id id, lot_project_listing_unit_id label FROM lot_project_listings WHERE lot_project_listing_id IN (?)`);
  await load('document', `SELECT document_id id, document_name label FROM documents WHERE document_id IN (?)`);
  await load('group', `SELECT seller_group_id id, seller_group_name label FROM seller_groups WHERE seller_group_id IN (?)`);
  await load('seller', `SELECT a.accredited_seller_id id, TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) label FROM accredited_sellers a INNER JOIN users u ON u.id=a.user_id WHERE a.accredited_seller_id IN (?)`);
  await load('user', `SELECT id, TRIM(CONCAT_WS(' ', first_name, middle_name, last_name)) label FROM users WHERE id IN (?)`);
  return lookups;
};

export const listOperationalReviews = async (req, res) => {
  try {
    const { page, limit } = pageValues(req.query);
    const offset = (page - 1) * limit;
    const scope = String(req.query.scope || 'queue') === 'history' ? 'history' : 'queue';
    const queue = reviewQueueWhere(req.authUser);
    // History means visible reviews that do NOT currently need this user's action.
    // Apply the exclusion in SQL *before* counting and paginating, otherwise
    // actionable reviews overlap with History and page totals become incorrect.
    const history = scope === 'history' ? reviewHistoryWhere(req.authUser) : null;
    const access = history
      ? { sql: `(${history.sql}) AND NOT (${queue.sql})`, params: [...history.params, ...queue.params] }
      : queue;
    const statuses = String(req.query.status || '').trim().split(',').map((v) => v.trim()).filter(Boolean);
    const params = [...access.params];
    let statusSql = '';
    if (statuses.length) { statusSql = ` AND r.status IN (${statuses.map(() => '?').join(',')})`; params.push(...statuses); }
    const [countRows] = await db.query(`SELECT COUNT(*) total FROM operational_reviews r WHERE ${access.sql}${statusSql}`, params);
    const [rows] = await db.query(
      `SELECT r.*, p.lot_project_name, (CASE WHEN ${queue.sql} THEN 1 ELSE 0 END) needs_my_action,
              TRIM(CONCAT_WS(' ', initiator.first_name,initiator.middle_name,initiator.last_name)) initiated_by_name,
              TRIM(CONCAT_WS(' ', claimant.first_name,claimant.middle_name,claimant.last_name)) claimed_by_name,
              TRIM(CONCAT_WS(' ', head.first_name,head.middle_name,head.last_name)) head_reviewed_by_name,
              TRIM(CONCAT_WS(' ', auditor.first_name,auditor.middle_name,auditor.last_name)) auditor_reviewed_by_name
       FROM operational_reviews r
       LEFT JOIN lot_projects p ON p.lot_project_id=r.lot_project_id
       LEFT JOIN users initiator ON initiator.id=r.initiated_by_user_id
       LEFT JOIN users claimant ON claimant.id=r.claimed_by_user_id
       LEFT JOIN users head ON head.id=r.head_reviewed_by_user_id
       LEFT JOIN users auditor ON auditor.id=r.auditor_reviewed_by_user_id
       WHERE ${access.sql}${statusSql}
       ORDER BY r.updated_at DESC,r.operational_review_id DESC LIMIT ? OFFSET ?`,
      [...queue.params, ...params, limit, offset]
    );
    return res.json({ data: rows.map((row) => ({ ...row, action_label: getReviewActionLabel(row.action_key), needs_my_action: Number(row.needs_my_action || 0) === 1 })), scope, pagination: { page, limit, total: Number(countRows[0]?.total || 0), totalPages: Math.max(1,Math.ceil(Number(countRows[0]?.total || 0)/limit)) } });
  } catch (error) { return res.status(500).json({ message: errorMessage(error) }); }
};

export const getReviewCenterSummary = async (req, res) => {
  try {
    const access = reviewQueueWhere(req.authUser);
    const [rows] = await db.query(
      `SELECT status,COUNT(*) total FROM operational_reviews r WHERE ${access.sql} GROUP BY status`, access.params
    );
    const counts = Object.fromEntries(rows.map((row) => [row.status, Number(row.total || 0)]));
    const actor = req.authUser || {};
    let actionable = 0;
    if (actor.role === 'auditor') actionable = Number(counts.pending_auditor_review || 0) + Number(counts.pending_auditor_recheck || 0) + Number(counts.audit_case_open || 0);
    else if (actor.role === 'system_admin') actionable = Number(counts.correction_required || 0) + Number(counts.audit_case_open || 0);
    else if (actor.role === 'super_admin') actionable = Number(counts.correction_required || 0);
    else {
      const department = getRoleDepartment(actor);
      const isHead = department && DEPARTMENT_HEAD_ROLE[department] === actor.role;
      actionable = isHead ? Number(counts.pending_head_review || 0) + Number(counts.audit_case_open || 0) : Number(counts.returned_for_correction || 0);
    }

    let protectedSql = 'p.requested_by_user_id = ? AND p.status IN (\'pending\',\'approved\')';
    let protectedParams = [actor.id];
    const actorDepartment = getRoleDepartment(actor);
    if (DEPARTMENT_STAFF_ROLES.includes(actor.role)) {
      // Staff use Review Center only for their own returned corrections/history.
      // Protected approvals are handled in the source workflow and are not a Staff tab.
      protectedSql = '1=0';
      protectedParams = [];
    } else if (actorDepartment && DEPARTMENT_HEAD_ROLE[actorDepartment] === actor.role) {
      protectedSql = `p.department = ? AND p.status = 'pending' AND (p.lot_project_id IS NULL OR COALESCE(?,0)=1 OR EXISTS(SELECT 1 FROM user_project_access upa WHERE upa.user_id=? AND upa.lot_project_id=p.lot_project_id))`;
      protectedParams = [actorDepartment, Number(actor.all_projects_access || actor.admin_all_projects || 0), actor.id];
    } else if (['super_admin','system_admin','auditor'].includes(actor.role)) {
      protectedSql = '1=0';
      protectedParams = [];
    }
    let protectedCountsAvailable = true;
    const [protectedRows] = await db.query(
      `SELECT COUNT(*) total FROM protected_change_requests p WHERE ${protectedSql}`,
      protectedParams
    ).catch((error) => {
      protectedCountsAvailable = false;
      logWorkflowSummaryError('protected_changes_count', error, actor);
      return [[{ total: 0 }]];
    });
    const pendingProtectedChanges = Number(protectedRows?.[0]?.total || 0);

    // An optional alert counter must not take down the entire Review Center.
    // The queue count is authoritative and continues to work if this complex
    // notification query is unsupported or fails on a particular DB version.
    const notificationCounts = await countWorkflowSummaryNotifications({
      connection: db,
      actorId: actor.id,
      visibility: notificationVisibilityWhere(actor),
      actionTypes: Object.keys(REVIEW_ACTION_NOTIFICATION_STAGES),
      onError: (error) => logWorkflowSummaryError('notification_counts', error, actor),
    });
    const { unreadNotifications, unreadActionNotifications, notificationCountsAvailable } = notificationCounts;
    const unreadInformationalNotifications = notificationCountsAvailable
      ? Math.max(0, unreadNotifications - unreadActionNotifications)
      : 0;
    return res.json({ data: {
      counts, actionable, pendingProtectedChanges, unreadNotifications,
      protectedCountsAvailable, notificationCountsAvailable,
      badgeCount: actionable + pendingProtectedChanges + unreadInformationalNotifications,
    } });
  } catch (error) {
    logWorkflowSummaryError('review_queue_count', error, req.authUser);
    return res.status(500).json({ message: 'Unable to load the Review Center summary. Please try again.' });
  }
};

// Proof review snapshots are immutable: they record scan status at upload time.
// Resolve *current* scan statuses separately so reviewers never mistake an old
// `pending` snapshot for a live scan result. No direct Cloudinary URLs/IDs leave
// this endpoint.
const isPaymentProofReview = (review) =>
  review?.action_key === 'payment_proof.verify' && review?.entity_type === 'lot_project_payment_proof';

const reviewProofIds = (review) => {
  const snapshot = parseSnapshot(review?.after_snapshot_json) || {};
  return [...new Set((Array.isArray(snapshot.proofs) ? snapshot.proofs : [])
    .map((proof) => Number(proof?.proofId || 0))
    .filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 25);
};

const liveReviewProofs = async (connection, review) => {
  if (!isPaymentProofReview(review)) return [];
  const paymentId = Number(review.entity_id || 0);
  const proofIds = reviewProofIds(review);
  if (!Number.isSafeInteger(paymentId) || paymentId <= 0 || !proofIds.length) return [];
  const [rows] = await connection.query(
    `SELECT lot_project_payment_proof_id, lot_project_payment_id, file_name,
            file_mime_type, proof_status, malware_scan_status,
            malware_scan_reason, malware_scanned_at, created_at
       FROM lot_project_payment_proofs
      WHERE lot_project_payment_id = ?
        AND lot_project_payment_proof_id IN (${proofIds.map(() => '?').join(',')})`,
    [paymentId, ...proofIds]
  );
  const found = new Map((rows || []).map((row) => [Number(row.lot_project_payment_proof_id), row]));
  const after = parseSnapshot(review.after_snapshot_json) || {};
  const byId = new Map((Array.isArray(after.proofs) ? after.proofs : []).map((p) => [Number(p?.proofId || 0), p]));
  return proofIds.map((proofId) => {
    const row = found.get(proofId);
    const snapshot = byId.get(proofId) || {};
    const status = String(row?.malware_scan_status || 'unknown').toLowerCase();
    return {
      proofId,
      fileName: row?.file_name || snapshot.fileName || 'Payment proof',
      fileType: row?.file_mime_type || '',
      proofStatus: row?.proof_status || 'unavailable',
      malwareScanStatus: status,
      malwareScanReason: row?.malware_scan_reason || null,
      malwareScannedAt: row?.malware_scanned_at || null,
      uploadedAt: row?.created_at || null,
      previewAvailable: status === 'approved' && row?.proof_status === 'active',
    };
  });
};

// Use the review's own visibility permissions (including History) and bind the
// proof to the payment and proof IDs captured in that review. This prevents
// guessing IDs to open unrelated Cloudinary assets.
// Read-only, review-authorized previews for records without an existing
// dedicated form. The service validates the exact project/record association.
// Serve only the signed receipt version explicitly recorded in this Review.
// Reuse authenticated Cloudinary streaming: no asset URL/ID is sent to the browser.
export const getOperationalReviewSignedReceiptContent = async (req, res) => {
  try {
    const reviewId = Number(req.params.id || 0);
    const fileId = Number(req.params.fileId || 0);
    if (!Number.isSafeInteger(reviewId) || reviewId < 1 || !Number.isSafeInteger(fileId) || fileId < 1)
      return res.status(400).json({ message: 'Invalid review or file.' });
    const [reviews] = await db.query('SELECT * FROM operational_reviews WHERE operational_review_id=? LIMIT 1',[reviewId]);
    const review = reviews[0];
    if (!review || !['lot_project_signed_receipt','lot_project_payment'].includes(review.entity_type)) return res.status(404).json({message:'Signed receipt not found in this review.'});
    if (!(await canActorOpenReview(db,req.authUser,review)) && !(await canActorViewReview(db,req.authUser,review)))
      return res.status(403).json({message:'You do not have access to this review.'});
    const after = parseSnapshot(review.after_snapshot_json) || {};
    const before = parseSnapshot(review.before_snapshot_json) || {};
    const allowedIds = [after?.signedCopy?.signedCopyId, before?.signedCopy?.signedCopyId].map(Number).filter((id)=>Number.isSafeInteger(id)&&id>0);
    if (review.entity_type !== 'lot_project_payment' && !allowedIds.includes(fileId)) return res.status(404).json({message:'This signed receipt is not part of the review.'});
    const [files] = await db.query(`SELECT f.file_name, f.file_mime_type, f.file_status,
        f.malware_scan_status, f.cloudinary_public_id, f.cloudinary_format, f.cloudinary_resource_type
        FROM lot_project_payment_acknowledgement_files f
        INNER JOIN lot_project_payments p ON p.lot_project_payment_id=f.lot_project_payment_id
        WHERE f.lot_project_payment_acknowledgement_file_id=? AND f.lot_project_payment_id=?
          AND p.lot_project_id=? LIMIT 1`,[fileId,Number(review.entity_id),Number(review.lot_project_id)]);
    const file=files[0];
    if (!file || file.file_status !== 'active') return res.status(404).json({message:'This signed receipt is no longer available.'});
    if (String(file.malware_scan_status || '').toLowerCase() !== 'approved')
      return res.status(423).json({message:'Preview is unavailable until the file passes its security scan.'});
    return await sendAuthenticatedAssetContent(res,{
      publicId:file.cloudinary_public_id, format:file.cloudinary_format,
      resourceType:file.cloudinary_resource_type, fileName:file.file_name,
      fileMimeType:file.file_mime_type,
    });
  } catch (error) {
    console.error('[workflow/signed-receipt]',error?.message || error);
    return res.status(500).json({message:'Unable to open the protected signed receipt.'});
  }
};

export const getOperationalReviewRecordPreview = async (req, res) => {
  try {
    const reviewId = Number(req.params.id || 0);
    if (!Number.isSafeInteger(reviewId) || reviewId < 1) return res.status(400).json({ message: 'Invalid review.' });
    const [rows] = await db.query('SELECT * FROM operational_reviews WHERE operational_review_id=? LIMIT 1', [reviewId]);
    const review = rows[0];
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    if (!(await canActorOpenReview(db, req.authUser, review)) && !(await canActorViewReview(db, req.authUser, review))) {
      return res.status(403).json({ message: 'You do not have access to this review.' });
    }
    if (!isExtraRecordPreview(review)) return res.status(404).json({ message: 'This review does not have a record preview.' });
    const result = await getReviewExtraRecord(db, review, req.query.page);
    return res.json({ data: result });
  } catch (error) {
    console.error('[workflow/record-preview]', error?.message || error);
    return res.status(500).json({ message: 'Unable to load this record. Its saved review remains available.' });
  }
};

export const getOperationalReviewProofContent = async (req, res) => {
  try {
    const reviewId = Number(req.params.id || 0);
    const proofId = Number(req.params.proofId || 0);
    if (!Number.isSafeInteger(reviewId) || reviewId <= 0 || !Number.isSafeInteger(proofId) || proofId <= 0) {
      return res.status(400).json({ message: 'Invalid review or proof reference.' });
    }
    const [reviews] = await db.query('SELECT * FROM operational_reviews WHERE operational_review_id = ? LIMIT 1', [reviewId]);
    const review = reviews[0];
    if (!review || (review.entity_type !== 'lot_project_payment' && (!isPaymentProofReview(review) || !reviewProofIds(review).includes(proofId)))) {
      return res.status(404).json({ message: 'Payment proof not found in this review.' });
    }
    const canAct = await canActorOpenReview(db, req.authUser, review);
    if (!canAct && !(await canActorViewReview(db, req.authUser, review))) {
      return res.status(403).json({ message: 'You do not have access to this review.' });
    }
    const [proofs] = await db.query(
      `SELECT cloudinary_public_id, cloudinary_format, cloudinary_resource_type,
              file_name, file_mime_type, malware_scan_status, proof_status
         FROM lot_project_payment_proofs
        WHERE lot_project_payment_proof_id = ? AND lot_project_payment_id = ?
          AND EXISTS (SELECT 1 FROM lot_project_payments p WHERE p.lot_project_payment_id=lot_project_payment_proofs.lot_project_payment_id AND p.lot_project_id=?) LIMIT 1`,
      [proofId, Number(review.entity_id), Number(review.lot_project_id)]
    );
    const proof = proofs[0];
    if (!proof || proof.proof_status !== 'active') {
      return res.status(404).json({ message: 'This payment proof is no longer available.' });
    }
    // Unlike ordinary proof access, in-review previews only accept confirmed
    // passed scans: no preview of pending, rejected, errored, or unscanned data.
    if (String(proof.malware_scan_status || '').toLowerCase() !== 'approved') {
      return res.status(423).json({ code: 'PROOF_NOT_SCAN_APPROVED', message: 'Preview is unavailable until the security scan passes.' });
    }
    return await sendAuthenticatedAssetContent(res, {
      publicId: proof.cloudinary_public_id,
      format: proof.cloudinary_format,
      resourceType: proof.cloudinary_resource_type,
      fileName: proof.file_name || 'payment-proof',
      fileMimeType: proof.file_mime_type,
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: 'Unable to open the protected payment proof.' });
  }
};

export const getOperationalReview = async (req, res) => {
  try {
    const reviewId = Number(req.params.id || 0);
    const [rows] = await db.query(`
      SELECT r.*, p.lot_project_name, p.lot_project_slug,
             TRIM(CONCAT_WS(' ', initiator.first_name,initiator.middle_name,initiator.last_name)) initiated_by_name,
             TRIM(CONCAT_WS(' ', head.first_name,head.middle_name,head.last_name)) head_reviewed_by_name,
             TRIM(CONCAT_WS(' ', auditor.first_name,auditor.middle_name,auditor.last_name)) auditor_reviewed_by_name,
             TRIM(CONCAT_WS(' ', claimant.first_name,claimant.middle_name,claimant.last_name)) claimed_by_name
      FROM operational_reviews r
      LEFT JOIN lot_projects p ON p.lot_project_id=r.lot_project_id
      LEFT JOIN users initiator ON initiator.id=r.initiated_by_user_id
      LEFT JOIN users head ON head.id=r.head_reviewed_by_user_id
      LEFT JOIN users auditor ON auditor.id=r.auditor_reviewed_by_user_id
      LEFT JOIN users claimant ON claimant.id=r.claimed_by_user_id
      WHERE r.operational_review_id=? LIMIT 1`, [reviewId]);
    const review = rows[0];
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    const canAct = await canActorOpenReview(db, req.authUser, review);
    if (!canAct && !(await canActorViewReview(db, req.authUser, review))) {
      return res.status(403).json({ code: 'REVIEW_NOT_VISIBLE', message: 'You do not have access to this review.' });
    }
    const [events] = await db.query(
      `SELECT e.*,TRIM(CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name)) actor_name FROM operational_review_events e LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.operational_review_id=? ORDER BY e.operational_review_event_id`, [reviewId]
    );
    const [caseRows] = await db.query(
      `SELECT * FROM audit_cases WHERE operational_review_id=? ORDER BY audit_case_id DESC LIMIT 1`, [reviewId]
    ).catch(() => [[]]);
    let auditCase = caseRows?.[0] || null;
    if (auditCase) {
      auditCase = { ...auditCase, correctionRole: getAuditCorrectionRole(review) };
    }
    if (auditCase) {
      const resolved = [...events].reverse().find(event => event.event_type === 'audit_case_resolved'
        && Number(parseSnapshot(event.metadata_json)?.auditCaseId) === Number(auditCase.audit_case_id));
      if (resolved) auditCase = { ...auditCase, resolution_notes: resolved.message, resolved_at: resolved.created_at,
        resolved_by_name: resolved.actor_name, resolved_by_role: resolved.actor_role };
    }
    // Older events stored raw action keys ("network.rates.update ...").
    // Show the readable action name instead.
    const actionKeys = Object.keys(REVIEW_ACTIONS).sort((a, b) => b.length - a.length);
    const readableEvents = events.map((event) => ({
      ...event,
      message: event.message
        ? actionKeys.reduce((text, key) => text.split(key).join(getReviewActionLabel(key)), String(event.message))
        : event.message,
    }));
    const displayReview = await enrichLegacyListingReviewSnapshots(db, review);
    const [lookups, location, proofFiles] = await Promise.all([buildReviewLookups(db, displayReview), resolveReviewRecordLocation(db, displayReview), liveReviewProofs(db, displayReview)]);
    return res.json({ data: { ...displayReview, action_label: getReviewActionLabel(displayReview.action_key), events: readableEvents, auditCase, lookups, proofFiles, ...location, viewer: { canAct, readOnly: !canAct } } });
  } catch (error) { return res.status(500).json({ message: errorMessage(error) }); }
};

const assertHeadForReview = async (connection, actor, review) => {
  const expected = DEPARTMENT_HEAD_ROLE[review.department];
  if (actor?.role !== expected) throw Object.assign(new Error(`Only the ${review.department} Head can perform this department review.`), { statusCode: 403 });
  if (!(await canActorSeeReview(connection, actor, review))) throw Object.assign(new Error('This review is outside your project scope.'), { statusCode: 403 });
};

export const claimOperationalReview = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const review = await getOperationalReviewForUpdate(connection, req.params.id);
    if (!review) throw Object.assign(new Error('Review not found.'), { statusCode: 404 });
    await assertHeadForReview(connection, req.authUser, review);
    if (review.status !== 'pending_head_review') throw Object.assign(new Error('Only pending Head reviews can be claimed.'), { statusCode: 409 });
    if (review.claimed_by_user_id && Number(review.claimed_by_user_id) !== Number(req.authUser.id)) throw Object.assign(new Error('Another Head already claimed this review.'), { statusCode: 409 });
    await connection.query('UPDATE operational_reviews SET claimed_by_user_id=?,claimed_at=COALESCE(claimed_at,NOW()) WHERE operational_review_id=?', [req.authUser.id, review.operational_review_id]);
    await appendReviewEvent(connection, { reviewId: review.operational_review_id, eventType: 'head_claimed', actor: req.authUser, fromStatus: review.status, toStatus: review.status });
    await connection.commit();
    return res.json({ message: 'Review claimed.' });
  } catch (error) { try { await connection.rollback(); } catch {} return res.status(error.statusCode || 500).json({ code: error.code, message: errorMessage(error) }); } finally { connection.release(); }
};

export const confirmHeadReview = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const review = await getOperationalReviewForUpdate(connection, req.params.id);
    if (!review) throw Object.assign(new Error('Review not found.'), { statusCode: 404 });
    await assertHeadForReview(connection, req.authUser, review);
    if (review.status !== 'pending_head_review') throw Object.assign(new Error('This review is no longer pending Head confirmation.'), { statusCode: 409 });
    const withApprovalType = Object.prototype.hasOwnProperty.call(review, 'approval_type');
    await connection.query(`UPDATE operational_reviews SET status='pending_auditor_review',claimed_by_user_id=?,claimed_at=NOW(),head_reviewed_by_user_id=?,head_reviewed_at=NOW()${withApprovalType ? ",approval_type='head_confirmed'" : ''} WHERE operational_review_id=?`, [req.authUser.id,req.authUser.id,review.operational_review_id]);
    await appendReviewEvent(connection, { reviewId: review.operational_review_id, eventType: 'head_confirmed', actor: req.authUser, fromStatus: review.status, toStatus: 'pending_auditor_review', message: String(req.body?.note || 'Head confirmed no mistake.').slice(0,1000) });
    await notifyAuditors(connection, { reviewId: review.operational_review_id, title: `Audit review required · ${review.entity_label || review.entity_type}`, message: `${review.review_number} was confirmed by the ${review.department} Head.` });
    await writeAuditLog(connection, req, { action:'approve',module:'Review Center',entityType:'operational_review',entityId:String(review.operational_review_id),entityLabel:review.review_number,title:'Department Head confirmed review',description:`${review.review_number} moved to Auditor review.`,metadata:{department:review.department,action_key:review.action_key} });
    await connection.commit();
    return res.json({ message: 'Confirmed. The Auditor has been notified. You can view this review in History.' });
  } catch (error) { try { await connection.rollback(); } catch {} return res.status(error.statusCode || 500).json({ code:error.code,message:errorMessage(error) }); } finally { connection.release(); }
};

export const returnReviewForCorrection = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5) return res.status(400).json({ message: 'Enter a clear correction reason.' });
    await connection.beginTransaction();
    const review = await getOperationalReviewForUpdate(connection, req.params.id);
    if (!review) throw Object.assign(new Error('Review not found.'), { statusCode: 404 });
    await assertHeadForReview(connection, req.authUser, review);
    if (review.status !== 'pending_head_review') throw Object.assign(new Error('This review cannot be returned from its current state.'), { statusCode: 409 });
    await connection.query(`UPDATE operational_reviews SET status='returned_for_correction',claimed_by_user_id=?,claimed_at=NOW(),head_reviewed_by_user_id=?,head_reviewed_at=NOW() WHERE operational_review_id=?`, [req.authUser.id,req.authUser.id,review.operational_review_id]);
    await appendReviewEvent(connection, { reviewId: review.operational_review_id, eventType: 'returned_for_correction', actor: req.authUser, fromStatus: review.status, toStatus: 'returned_for_correction', message: reason });
    await createInternalNotifications(connection, {
      userIds:[review.initiated_by_user_id],
      type:'review_returned',
      title:`Correction requested — action required · ${review.entity_label || review.entity_type}`,
      message:`${review.review_number}: ${reason} Open this Review, complete a permitted correction, then use ${MANUAL_RESUBMIT_ACTION_KEYS.has(review.action_key) || MANUAL_RESUBMIT_ENTITY_TYPES.has(review.entity_type) ? 'Submit Correction Details for Recheck' : 'Correct & Resubmit'} to send it back to the Head.`,
      reviewId:review.operational_review_id,
    });
    await connection.commit();
    return res.json({ message: 'Returned for correction. The original staff member has been notified. The record remains editable by authorized users and all edits are logged.' });
  } catch (error) { try { await connection.rollback(); } catch {} return res.status(error.statusCode || 500).json({ code:error.code,message:errorMessage(error) }); } finally { connection.release(); }
};

// Completed actions (imports, releases, deletes, etc.) cannot always be edited
// in place. Staff can perform an authorized compensating action, then describe
// the correction here. This resubmits the SAME review without changing the
// original operation snapshots or falsely asserting an in-place edit occurred.
const MANUAL_RESUBMIT_ACTION_KEYS = new Set([
  'reservation.create', 'buyer_form.approve', 'commission.release', 'commission.hold',
  'commission.unhold', 'listing.delete', 'listing.import', 'listing.import_undo',
  'network.members.import',
]);
const MANUAL_RESUBMIT_ENTITY_TYPES = new Set(['lot_project_account', 'lot_project_buyer_form', 'lot_project_commission']);

export const resubmitManualReviewCorrection = async (req, res) => {
  const correctionSummary = String(req.body?.correctionSummary || '').trim();
  if (correctionSummary.length < 15 || correctionSummary.length > 4000) {
    return res.status(400).json({ message: 'Describe the completed correction and reference the affected records (15–4000 characters).' });
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const review = await getOperationalReviewForUpdate(connection, req.params.id);
    if (!review) throw Object.assign(new Error('Review not found.'), { statusCode: 404 });
    if (review.status !== 'returned_for_correction') {
      throw Object.assign(new Error('This review is no longer awaiting staff correction.'), { statusCode: 409 });
    }
    if (!DEPARTMENT_STAFF_ROLES.includes(req.authUser?.role)
      || Number(review.initiated_by_user_id) !== Number(req.authUser?.id)
      || getRoleDepartment(req.authUser) !== review.department
      || !(await canActorSeeReview(connection, req.authUser, review))) {
      throw Object.assign(new Error('Only the original authorized staff member can resubmit this review.'), { statusCode: 403 });
    }
    if (!MANUAL_RESUBMIT_ACTION_KEYS.has(review.action_key) && !MANUAL_RESUBMIT_ENTITY_TYPES.has(review.entity_type)) {
      throw Object.assign(new Error('Use the record correction workflow for this review.'), { statusCode: 409 });
    }
    await connection.query(
      `UPDATE operational_reviews SET status='pending_head_review', revision=revision+1,
          claimed_by_user_id=NULL, claimed_at=NULL,
          head_reviewed_by_user_id=NULL, head_reviewed_at=NULL,
          auditor_reviewed_by_user_id=NULL, auditor_reviewed_at=NULL
       WHERE operational_review_id=? AND status='returned_for_correction'`,
      [review.operational_review_id]
    );
    await appendReviewEvent(connection, {
      reviewId: review.operational_review_id, eventType: 'staff_correction_submitted', actor: req.authUser,
      fromStatus: 'returned_for_correction', toStatus: 'pending_head_review',
      message: `Staff-reported follow-up correction (original action preserved): ${correctionSummary}`,
      metadata: {
        correctionMode: 'manual_follow_up', actionKey: review.action_key,
        previousActionKey: review.action_key, latestActionKey: review.action_key,
        previousRevision: Number(review.revision || 1), reviewRevision: Number(review.revision || 1) + 1,
        previousBeforeSnapshot: review.before_snapshot_json ?? null,
        previousAfterSnapshot: review.after_snapshot_json ?? null,
        // The review is being resubmitted, not changed: carry forward the same evidence.
        nextBeforeSnapshot: review.before_snapshot_json ?? null,
        nextAfterSnapshot: review.after_snapshot_json ?? null,
      },
    });
    await notifyDepartmentHeads(connection, {
      department: review.department, projectId: review.lot_project_id,
      reviewId: review.operational_review_id,
      title: `Correction submitted for Head recheck · ${review.review_number}`,
      message: `${review.entity_label || review.entity_type}: the original staff member reports a follow-up correction. Verify the actual record and audit trail before confirmation.`,
    });
    await writeAuditLog(connection, req, {
      action: 'update', module: 'Review Center', entityType: 'operational_review',
      entityId: String(review.operational_review_id), entityLabel: review.review_number,
      title: 'Staff submitted correction details for recheck', description: correctionSummary,
      metadata: { department: review.department, action_key: review.action_key, mode: 'manual_follow_up' },
    });
    await connection.commit();
    return res.json({ message: 'Correction details sent to the Department Head for recheck. Your original operation and the follow-up note remain in the review history.' });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ code: error.code, message: errorMessage(error) });
  } finally { connection.release(); }
};

export const auditorVerifyReview = async (req, res) => {
  const connection = await db.getConnection();
  try {
    if (req.authUser?.role !== 'auditor') return res.status(403).json({ message: 'Only an Auditor can complete independent audit verification.' });
    await connection.beginTransaction();
    const review = await getOperationalReviewForUpdate(connection, req.params.id);
    if (!review) throw Object.assign(new Error('Review not found.'), { statusCode: 404 });
    if (review.status !== 'pending_auditor_review') throw Object.assign(new Error('This review is not awaiting Auditor verification.'), { statusCode: 409 });
    const previous = review.status;
    await connection.query(`UPDATE operational_reviews SET status='closed',auditor_reviewed_by_user_id=?,auditor_reviewed_at=NOW() WHERE operational_review_id=?`, [req.authUser.id,review.operational_review_id]);
    await appendReviewEvent(connection, { reviewId:review.operational_review_id,eventType:'auditor_verified',actor:req.authUser,fromStatus:previous,toStatus:'closed',message:String(req.body?.note || 'Auditor verified no issue.').slice(0,1000) });
    await writeAuditLog(connection, req, { action:'approve',module:'Review Center',entityType:'operational_review',entityId:String(review.operational_review_id),entityLabel:review.review_number,title:'Auditor verified operational review',description:`${review.review_number} closed after independent verification.`,metadata:{action_key:review.action_key} });
    await connection.commit();
    return res.json({ message: 'Audit verification completed. Review closed. It remains available in History.' });
  } catch (error) { try { await connection.rollback(); } catch {} return res.status(error.statusCode || 500).json({ code:error.code,message:errorMessage(error) }); } finally { connection.release(); }
};

export const listInternalNotifications = async (req, res) => {
  try {
    const { page,limit } = pageValues(req.query); const offset=(page-1)*limit;
    // Action notifications for work that already moved on (another Head or
    // Auditor acted, or the case was reassigned) are hidden for everyone.
    const access = notificationVisibilityWhere(req.authUser);
    const [countRows] = await db.query(`SELECT COUNT(*) total FROM internal_notifications n ${access.join} WHERE n.user_id=? AND ${access.sql}`,[req.authUser.id,...access.params]);
    const [rows] = await db.query(`SELECT n.* FROM internal_notifications n ${access.join} WHERE n.user_id=? AND ${access.sql} ORDER BY n.created_at DESC,n.internal_notification_id DESC LIMIT ? OFFSET ?`,[req.authUser.id,...access.params,limit,offset]);
    return res.json({ data:rows,pagination:{page,limit,total:Number(countRows[0]?.total||0)} });
  } catch(error){ return res.status(500).json({message:errorMessage(error)}); }
};

export const markInternalNotificationRead = async (req,res) => {
  try { await db.query('UPDATE internal_notifications SET read_at=COALESCE(read_at,NOW()) WHERE internal_notification_id=? AND user_id=?',[Number(req.params.id),req.authUser.id]); return res.json({message:'Notification marked read.'}); }
  catch(error){ return res.status(500).json({message:errorMessage(error)}); }
};

// Read state is independent of the operational review workflow. Mark only
// currently visible unread messages belonging to the authenticated account.
export const markAllInternalNotificationsRead = async (req, res) => {
  let connection;
  try {
    const access = notificationVisibilityWhere(req.authUser);
    connection = await db.getConnection();
    await connection.beginTransaction();
    const markedCount = await markVisibleInternalNotificationsRead(connection, req.authUser.id, access);
    await connection.commit();
    return res.json({ message: markedCount ? `${markedCount} notification${markedCount === 1 ? '' : 's'} marked as read.` : 'All notifications are already read.', markedCount });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch {} }
    console.error('[workflow/notifications/read-all]', { code: error?.code || null, message: error?.message || 'Unknown error' });
    return res.status(500).json({ message: 'Unable to mark notifications as read. Please retry.' });
  } finally {
    if (connection) connection.release();
  }
};

const caseNumber = (id) => `CASE-${String(id).padStart(8, '0')}`;

export const openAuditCase = async (req,res) => {
  const connection=await db.getConnection();
  try {
    if(req.authUser?.role!=='auditor') return res.status(403).json({message:'Only an Auditor can open an Audit Case.'});
    const finding=String(req.body?.finding||'').trim();
    if(finding.length<5) return res.status(400).json({message:'Describe the audit finding before opening a case.'});
    await connection.beginTransaction();
    const review=await getOperationalReviewForUpdate(connection,req.params.id);
    if(!review) throw Object.assign(new Error('Review not found.'),{statusCode:404});
    if(review.status!=='pending_auditor_review') throw Object.assign(new Error('An Audit Case can be opened only while the review is pending Auditor review.'),{statusCode:409});
    const [existing]=await connection.query("SELECT audit_case_id,case_number FROM audit_cases WHERE operational_review_id=? AND status NOT IN ('closed','finding_invalid') LIMIT 1 FOR UPDATE",[review.operational_review_id]);
    if(existing[0]) throw Object.assign(new Error(`${existing[0].case_number||'An Audit Case'} is already open for this review.`),{statusCode:409});
    const [result]=await connection.query("INSERT INTO audit_cases (operational_review_id,opened_by_auditor_user_id,finding,status) VALUES (?,?,?,'pending_system_admin_correction')",[review.operational_review_id,req.authUser.id,finding]);
    const caseId=Number(result.insertId); const number=caseNumber(caseId);
    await connection.query('UPDATE audit_cases SET case_number=? WHERE audit_case_id=?',[number,caseId]);
    await connection.query("UPDATE operational_reviews SET status='correction_required',auditor_reviewed_by_user_id=?,auditor_reviewed_at=NOW() WHERE operational_review_id=?",[req.authUser.id,review.operational_review_id]);
    await appendReviewEvent(connection,{reviewId:review.operational_review_id,eventType:'audit_case_opened',actor:req.authUser,fromStatus:review.status,toStatus:'correction_required',message:finding,metadata:{auditCaseId:caseId,caseNumber:number,correctionRole:getAuditCorrectionRole(review)}});
    await notifyCorrectionOwners(connection,review,{audit_case_id:caseId,case_number:number,finding});
    await writeAuditLog(connection,req,{action:'create',module:'Audit Cases',entityType:'audit_case',entityId:String(caseId),entityLabel:number,title:'Opened Audit Case',description:`${number} opened for ${review.review_number}.`,metadata:{finding,reviewId:review.operational_review_id}});
    await connection.commit();
    return res.status(201).json({message:'Finding sent to the correction queue.',data:{auditCaseId:caseId,caseNumber:number,status:'pending_system_admin_correction'}});
  }catch(error){try{await connection.rollback()}catch{} return res.status(error.statusCode||500).json({code:error.code,message:errorMessage(error)});}finally{connection.release();}
};

const retiredAuditStep = (_req,res) => res.status(409).json({ code:'AUDIT_FLOW_UPDATED', message:'This case now follows the direct correction flow. Reload Review Center. The authorized administrator corrects the record and resolves it with notes.' });
export const respondToAuditCase = retiredAuditStep;
export const reassignAuditCaseResponder = retiredAuditStep;
export const resolveAuditCase = retiredAuditStep;

export const resolveAuditCaseByAdmin = async (req,res) => {
  const connection=await db.getConnection();
  try {
    if (!['system_admin','super_admin'].includes(req.authUser?.role)) return res.status(403).json({message:'Only the authorized administrator may resolve this case.'});
    await connection.beginTransaction();
    const [rows]=await connection.query(`SELECT r.*,c.* FROM audit_cases c INNER JOIN operational_reviews r ON r.operational_review_id=c.operational_review_id WHERE c.audit_case_id=? LIMIT 1 FOR UPDATE`,[Number(req.params.caseId)]);
    const auditCase=rows[0];
    if (!auditCase) throw Object.assign(new Error('Audit Case not found.'),{statusCode:404});
    const notes=String(req.body?.notes || '').trim();
    await resolveAuditCaseWithNotes(connection,{auditCase,actor:req.authUser,notes});
    await writeAuditLog(connection,req,{action:'update',module:'Audit Cases',entityType:'audit_case',entityId:String(auditCase.audit_case_id),entityLabel:auditCase.case_number,title:'Resolved Audit Case with Notes',description:notes,metadata:{reviewId:auditCase.operational_review_id,correctionRole:getAuditCorrectionRole(auditCase)}});
    await connection.commit();
    return res.json({message:`Resolved by ${req.authUser.role==='super_admin'?'Super Admin':'System Admin'}. The Auditor has been notified.`});
  } catch(error) { try { await connection.rollback(); } catch {} return res.status(error.statusCode||500).json({code:error.code,message:errorMessage(error)}); }
  finally { connection.release(); }
};

export const getAuditCase = async (req,res) => {
  try {
    const [rows]=await db.query(`SELECT c.*,r.review_number,r.action_key,r.department,r.lot_project_id,r.entity_type,r.entity_id,r.entity_label,r.initiated_by_user_id,r.initiated_by_role,r.approval_type,r.status AS review_status FROM audit_cases c INNER JOIN operational_reviews r ON r.operational_review_id=c.operational_review_id WHERE c.audit_case_id=? LIMIT 1`,[Number(req.params.caseId)]);
    const row=rows[0];
    if(!row)return res.status(404).json({message:'Audit Case not found.'});
    const reviewView={...row,status:row.review_status,operational_review_id:row.operational_review_id};
    if(!(await canActorOpenReview(db,req.authUser,reviewView)) && !(await canActorViewReview(db,req.authUser,reviewView)))return res.status(403).json({message:'You do not have access to this Audit Case.'});
    return res.json({data:row});
  }catch(error){return res.status(500).json({message:errorMessage(error)});}
};

export const listProtectedChangeRequests = async (req,res) => {
  try{
    const actor=req.authUser||{}; const {page,limit}=pageValues(req.query); const offset=(page-1)*limit;
    let where='1=0',params=[];
    const department=getRoleDepartment(actor);
    if(DEPARTMENT_HEAD_ROLE[department]===actor.role){where="p.department=? AND (p.lot_project_id IS NULL OR COALESCE(?,0)=1 OR EXISTS(SELECT 1 FROM user_project_access upa WHERE upa.user_id=? AND upa.lot_project_id=p.lot_project_id))";params=[department,Number(actor.all_projects_access||actor.admin_all_projects||0),actor.id];}
    const requestedStatus=String(req.query.status||'').trim();if(requestedStatus){where+=` AND p.status=?`;params.push(requestedStatus);}
    const [countRows]=await db.query(`SELECT COUNT(*) total FROM protected_change_requests p WHERE ${where}`,params);
    const [rows]=await db.query(`SELECT p.*,TRIM(CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name)) requested_by_name,TRIM(CONCAT_WS(' ',h.first_name,h.middle_name,h.last_name)) reviewed_by_head_name,lp.lot_project_name FROM protected_change_requests p LEFT JOIN users u ON u.id=p.requested_by_user_id LEFT JOIN users h ON h.id=p.reviewed_by_head_user_id LEFT JOIN lot_projects lp ON lp.lot_project_id=p.lot_project_id WHERE ${where} ORDER BY p.created_at DESC,p.protected_change_request_id DESC LIMIT ? OFFSET ?`,[...params,limit,offset]);
    const total=Number(countRows[0]?.total||0); const totalPages=Math.max(1,Math.ceil(total/limit)); return res.json({data:rows,pagination:{page,limit,total,totalPages,hasNext:page<totalPages,hasPrev:page>1}});
  }catch(error){return res.status(500).json({message:errorMessage(error)});}
};

export const reviewProtectedChangeRequest = async (req,res) => {
  const connection=await db.getConnection();
  try{
    const decision=String(req.body?.decision||'').trim().toLowerCase(); if(!['approve','reject'].includes(decision))return res.status(400).json({message:'Decision must be approve or reject.'});
    await connection.beginTransaction(); const row=await approveProtectedChange(connection,{requestId:req.params.requestId,actor:req.authUser,approve:decision==='approve',note:req.body?.note});
    await writeAuditLog(connection,req,{action:decision==='approve'?'approve':'reject',module:'Review Center',entityType:'protected_change_request',entityId:String(row.protected_change_request_id),entityLabel:row.request_number,title:`Department Head ${decision}d protected change`,description:`${row.request_number} was ${decision}d by the Department Head.`,metadata:{action_key:row.action_key,department:row.department}});
    await connection.commit(); return res.json({message:`Protected change ${decision}d.`,data:{requestId:row.protected_change_request_id,requestNumber:row.request_number,status:row.status}});
  }catch(error){try{await connection.rollback()}catch{}return res.status(error.statusCode||500).json({code:error.code,message:errorMessage(error)});}finally{connection.release();}
};








