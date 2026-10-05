import crypto from 'node:crypto';
import { DEPARTMENT_HEAD_ROLE, getRoleDepartment } from '../config/permissions.js';
import { createInternalNotifications, notifyAuditors, notifyDepartmentHeads } from './internalNotification.service.js';
import { assertRegisteredReviewAction } from '../config/reviewActions.js';

export const REVIEW_LOCKING_STATUSES = Object.freeze([
  'pending_head_review','pending_auditor_review','audit_case_open','correction_required','pending_auditor_recheck',
]);

const jsonValue = (value) => value == null ? null : JSON.stringify(value);
const reviewNumber = (id) => `REV-${String(id).padStart(8, '0')}`;

export const appendReviewEvent = async (connection, {
  reviewId, eventType, actor = null, fromStatus = null, toStatus = null, message = null, metadata = null,
}) => {
  await connection.query(
    `INSERT INTO operational_review_events (operational_review_id,event_type,from_status,to_status,actor_user_id,actor_role,message,metadata_json)
     VALUES (?,?,?,?,?,?,?,?)`,
    [reviewId, eventType, fromStatus, toStatus, actor?.id || null, actor?.role || null, message, jsonValue(metadata)]
  );
};

// approval_type records HOW a review reached the Auditor. Older databases
// without the column (before migration batch6) keep working without it.
let approvalTypeColumnPromise = null;
const hasApprovalTypeColumn = async (connection) => {
  if (!approvalTypeColumnPromise) {
    approvalTypeColumnPromise = connection.query(
      `SELECT 1 FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'operational_reviews' AND COLUMN_NAME = 'approval_type' LIMIT 1`
    ).then(([rows]) => rows.length > 0).catch(() => false);
  }
  const exists = await approvalTypeColumnPromise;
  if (!exists) approvalTypeColumnPromise = null; // re-check after the migration is applied
  return exists;
};

export const REVIEW_APPROVAL_TYPES = Object.freeze({
  STAFF_ENTRY: 'staff_entry',
  HEAD_SELF: 'head_self',
  HEAD_PREAPPROVED: 'head_preapproved',
  HEAD_CORRECTED: 'head_corrected',
  EMERGENCY_SUPER_ADMIN: 'emergency_super_admin',
});

/**
 * Head "Correct & Confirm" (plan item 15): when a Department Head changes a
 * record that still has an open Staff review (pending Head review or returned
 * for correction), the Head's change is folded into THAT review instead of
 * opening a second one. The Staff values stay in the event history, the Head
 * becomes the reviewer, and the review goes straight to the Auditor.
 */
const absorbOpenStaffReviewIntoHeadCorrection = async (connection, {
  actor, actionKey, department, entityType, entityId, entityLabel, beforeSnapshot, afterSnapshot,
}) => {
  const [rows] = await connection.query(
    `SELECT * FROM operational_reviews
     WHERE entity_type = ? AND entity_id = ? AND department = ?
       AND status IN ('pending_head_review','returned_for_correction')
     ORDER BY operational_review_id DESC LIMIT 1 FOR UPDATE`,
    [entityType, String(entityId), department]
  );
  const open = rows[0];
  if (!open) return null;
  if (open.claimed_by_user_id && Number(open.claimed_by_user_id) !== Number(actor.id)) {
    throw Object.assign(new Error(`${open.review_number || 'This review'} is claimed by another Head. Ask them to release it before correcting the record.`), { statusCode: 409, code: 'REVIEW_CLAIMED_BY_OTHER_HEAD' });
  }
  const withType = await hasApprovalTypeColumn(connection);
  await connection.query(
    `UPDATE operational_reviews
     SET status = 'pending_auditor_review',
         revision = revision + 1,
         after_snapshot_json = ?,
         claimed_by_user_id = ?, claimed_at = COALESCE(claimed_at, NOW()),
         head_reviewed_by_user_id = ?, head_reviewed_at = NOW()${withType ? ", approval_type = 'head_corrected'" : ''}
     WHERE operational_review_id = ?`,
    [jsonValue(afterSnapshot), actor.id, actor.id, open.operational_review_id]
  );
  await appendReviewEvent(connection, {
    reviewId: open.operational_review_id,
    eventType: 'head_corrected_and_confirmed',
    actor,
    fromStatus: open.status,
    toStatus: 'pending_auditor_review',
    message: `${actionKey} corrected by the Department Head and confirmed for audit.`,
    metadata: {
      headActionKey: actionKey,
      staffAfterSnapshot: open.after_snapshot_json ?? null,
      headBeforeSnapshot: beforeSnapshot ?? null,
    },
  });
  await createInternalNotifications(connection, {
    userIds: [open.initiated_by_user_id].filter((id) => Number(id) && Number(id) !== Number(actor.id)),
    type: 'review_head_corrected',
    title: `Head corrected your entry · ${open.review_number}`,
    message: `${entityLabel || open.entity_label || entityType} was corrected by the Department Head and sent to the Auditor.`,
    reviewId: open.operational_review_id,
    link: '/portal/review-center',
  });
  await notifyAuditors(connection, {
    reviewId: open.operational_review_id,
    title: `Audit review required · ${entityLabel || open.entity_label || entityType}`,
    message: `${open.review_number} was corrected and confirmed by the Department Head.`,
  });
  return { reviewId: Number(open.operational_review_id), reviewNumber: open.review_number, status: 'pending_auditor_review', headCorrected: true };
};

export const createOperationalReview = async (connection, {
  actor, actionKey, department, projectId = null, entityType, entityId, entityLabel = null,
  beforeSnapshot = null, afterSnapshot = null, link = '/portal/review-center', headPreApprovedByUserId = null,
}) => {
  if (!actor?.id) throw Object.assign(new Error('Authenticated actor is required to create a review.'), { statusCode: 400 });
  const expectedHeadRole = DEPARTMENT_HEAD_ROLE[department];
  if (!expectedHeadRole) throw Object.assign(new Error('Review department is invalid.'), { statusCode: 400 });
  assertRegisteredReviewAction(actionKey, department);

  const isEmergency = actor.role === 'super_admin';
  const isDepartmentHead = actor.role === expectedHeadRole;
  const preApprovedHeadId = isEmergency ? 0 : Number(headPreApprovedByUserId || 0);

  if (isDepartmentHead) {
    const absorbed = await absorbOpenStaffReviewIntoHeadCorrection(connection, {
      actor, actionKey, department, entityType, entityId, entityLabel, beforeSnapshot, afterSnapshot,
    });
    if (absorbed) return absorbed;
  }

  // Super Admin emergency edits are NOT recorded as a Head approval. Super Admin
  // answers any Audit Case on them (fixes the stuck-case bug, plan item 16).
  const approvalType = isEmergency
    ? REVIEW_APPROVAL_TYPES.EMERGENCY_SUPER_ADMIN
    : isDepartmentHead
      ? REVIEW_APPROVAL_TYPES.HEAD_SELF
      : preApprovedHeadId > 0
        ? REVIEW_APPROVAL_TYPES.HEAD_PREAPPROVED
        : REVIEW_APPROVAL_TYPES.STAFF_ENTRY;
  const initialStatus = approvalType === REVIEW_APPROVAL_TYPES.STAFF_ENTRY ? 'pending_head_review' : 'pending_auditor_review';
  const headReviewerId = initialStatus === 'pending_auditor_review' && !isEmergency
    ? (preApprovedHeadId || actor.id)
    : null;

  const withType = await hasApprovalTypeColumn(connection);
  const [result] = await connection.query(
    `INSERT INTO operational_reviews (action_key,department,lot_project_id,entity_type,entity_id,entity_label,initiated_by_user_id,initiated_by_role,before_snapshot_json,after_snapshot_json,status,head_reviewed_by_user_id,head_reviewed_at${withType ? ',approval_type' : ''})
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?${withType ? ',?' : ''})`,
    [actionKey, department, projectId || null, entityType, String(entityId), entityLabel, actor.id, actor.role, jsonValue(beforeSnapshot), jsonValue(afterSnapshot), initialStatus,
      headReviewerId, headReviewerId ? new Date() : null, ...(withType ? [approvalType] : [])]
  );
  const reviewId = Number(result.insertId);
  const number = reviewNumber(reviewId);
  await connection.query('UPDATE operational_reviews SET review_number = ? WHERE operational_review_id = ?', [number, reviewId]);
  await appendReviewEvent(connection, {
    reviewId, eventType: 'created', actor, toStatus: initialStatus,
    message: `${actionKey} created for independent review.`,
    metadata: { approvalType },
  });

  if (initialStatus === 'pending_auditor_review') {
    const message = {
      [REVIEW_APPROVAL_TYPES.EMERGENCY_SUPER_ADMIN]: `${number} was an emergency Super Admin change and needs independent audit.`,
      [REVIEW_APPROVAL_TYPES.HEAD_PREAPPROVED]: `${number} was pre-approved by the Department Head and is ready for independent audit.`,
      [REVIEW_APPROVAL_TYPES.HEAD_SELF]: `${number} was entered by the ${expectedHeadRole.replaceAll('_',' ')} and skipped self-review.`,
    }[approvalType];
    await notifyAuditors(connection, { reviewId, title: `Audit review required · ${entityLabel || entityType}`, message });
  } else {
    const recipients = await notifyDepartmentHeads(connection, { department, projectId, reviewId, title: `Department review required · ${entityLabel || entityType}`, message: `${number} requires ${department} Head review.` });
    if (!recipients.length) {
      const [adminRows] = await connection.query("SELECT id FROM users WHERE role='system_admin' AND status='active'");
      await createInternalNotifications(connection, { userIds: adminRows.map((row) => row.id), type: 'review_has_no_head', title: `No ${department} Head available`, message: `${number} has no eligible Head for this project. Assign Head coverage.`, reviewId, link });
    }
  }
  return { reviewId, reviewNumber: number, status: initialStatus, approvalType };
};

export const getOperationalReviewForUpdate = async (connection, reviewId) => {
  const [rows] = await connection.query('SELECT * FROM operational_reviews WHERE operational_review_id = ? LIMIT 1 FOR UPDATE', [Number(reviewId)]);
  return rows[0] || null;
};

/**
 * Blocks changes to a record while a review/case is open on it.
 * A Department Head may still change a record whose review is waiting for
 * THEIR department's Head review (Correct & Confirm), unless another Head
 * has claimed it. Pass `actor` to enable that exception.
 */
export const assertEntityNotReviewLocked = async (connection, { entityType, entityId, allowReviewId = null, actor = null }) => {
  const statuses = REVIEW_LOCKING_STATUSES.map(() => '?').join(',');
  const params = [entityType, String(entityId), ...REVIEW_LOCKING_STATUSES];
  let exclusion = '';
  if (allowReviewId) { exclusion = ' AND operational_review_id <> ?'; params.push(Number(allowReviewId)); }
  const [rows] = await connection.query(
    `SELECT operational_review_id,review_number,status,department,claimed_by_user_id FROM operational_reviews WHERE entity_type=? AND entity_id=? AND status IN (${statuses})${exclusion} ORDER BY operational_review_id DESC LIMIT 1`, params
  );
  const lock = rows[0];
  if (!lock) return true;
  const headCanCorrect = Boolean(actor?.id)
    && lock.status === 'pending_head_review'
    && actor.role === DEPARTMENT_HEAD_ROLE[lock.department]
    && (!lock.claimed_by_user_id || Number(lock.claimed_by_user_id) === Number(actor.id));
  if (headCanCorrect) return true;
  throw Object.assign(new Error(`This record is locked by ${lock.review_number || `Review #${lock.operational_review_id}`} (${lock.status.replaceAll('_',' ')}).`), { statusCode: 409, code: 'REVIEW_LOCKED', review: lock });
};

export const canActorSeeReview = async (connection, actor, review) => {
  if (!actor || !review) return false;
  if (['super_admin','system_admin','auditor'].includes(actor.role)) return true;
  const department = getRoleDepartment(actor);
  if (department !== review.department) return false;
  const expectedHeadRole = DEPARTMENT_HEAD_ROLE[department];
  if (actor.role !== expectedHeadRole && Number(review.initiated_by_user_id || 0) !== Number(actor.id || 0)) return false;
  if (!review.lot_project_id) return true;
  if (Number(actor.all_projects_access || actor.admin_all_projects || 0) === 1) return true;
  const [rows] = await connection.query('SELECT 1 FROM user_project_access WHERE user_id=? AND lot_project_id=? LIMIT 1', [actor.id, review.lot_project_id]);
  return Boolean(rows.length);
};

export const buildReviewPayloadHash = (payload) => crypto.createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
