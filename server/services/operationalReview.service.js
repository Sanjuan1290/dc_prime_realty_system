import crypto from 'node:crypto';
import { DEPARTMENT_HEAD_ROLE, getRoleDepartment } from '../config/permissions.js';
import { createInternalNotifications, notifyAuditors, notifyDepartmentHeads } from './internalNotification.service.js';

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

export const createOperationalReview = async (connection, {
  actor, actionKey, department, projectId = null, entityType, entityId, entityLabel = null,
  beforeSnapshot = null, afterSnapshot = null, link = '/portal/review-center', headPreApprovedByUserId = null,
}) => {
  if (!actor?.id) throw Object.assign(new Error('Authenticated actor is required to create a review.'), { statusCode: 400 });
  const expectedHeadRole = DEPARTMENT_HEAD_ROLE[department];
  if (!expectedHeadRole) throw Object.assign(new Error('Review department is invalid.'), { statusCode: 400 });
  const initialStatus = actor.role === expectedHeadRole || Number(headPreApprovedByUserId || 0) > 0 ? 'pending_auditor_review' : 'pending_head_review';
  const [result] = await connection.query(
    `INSERT INTO operational_reviews (action_key,department,lot_project_id,entity_type,entity_id,entity_label,initiated_by_user_id,initiated_by_role,before_snapshot_json,after_snapshot_json,status,head_reviewed_by_user_id,head_reviewed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?, ?, ?)`,
    [actionKey, department, projectId || null, entityType, String(entityId), entityLabel, actor.id, actor.role, jsonValue(beforeSnapshot), jsonValue(afterSnapshot), initialStatus,
      initialStatus === 'pending_auditor_review' ? (Number(headPreApprovedByUserId || 0) || actor.id) : null, initialStatus === 'pending_auditor_review' ? new Date() : null]
  );
  const reviewId = Number(result.insertId);
  const number = reviewNumber(reviewId);
  await connection.query('UPDATE operational_reviews SET review_number = ? WHERE operational_review_id = ?', [number, reviewId]);
  await appendReviewEvent(connection, { reviewId, eventType: 'created', actor, toStatus: initialStatus, message: `${actionKey} created for independent review.` });

  if (initialStatus === 'pending_auditor_review') {
    await notifyAuditors(connection, { reviewId, title: `Audit review required · ${entityLabel || entityType}`, message: headPreApprovedByUserId ? `${number} was pre-approved by the Department Head and is ready for independent audit.` : `${number} was entered by the ${expectedHeadRole.replaceAll('_',' ')} and skipped self-review.` });
  } else {
    const recipients = await notifyDepartmentHeads(connection, { department, projectId, reviewId, title: `Department review required · ${entityLabel || entityType}`, message: `${number} requires ${department} Head review.` });
    if (!recipients.length) {
      const [adminRows] = await connection.query("SELECT id FROM users WHERE role='system_admin' AND status='active'");
      await createInternalNotifications(connection, { userIds: adminRows.map((row) => row.id), type: 'review_has_no_head', title: `No ${department} Head available`, message: `${number} has no eligible Head for this project. Assign Head coverage.`, reviewId, link });
    }
  }
  return { reviewId, reviewNumber: number, status: initialStatus };
};

export const getOperationalReviewForUpdate = async (connection, reviewId) => {
  const [rows] = await connection.query('SELECT * FROM operational_reviews WHERE operational_review_id = ? LIMIT 1 FOR UPDATE', [Number(reviewId)]);
  return rows[0] || null;
};

export const assertEntityNotReviewLocked = async (connection, { entityType, entityId, allowReviewId = null }) => {
  const statuses = REVIEW_LOCKING_STATUSES.map(() => '?').join(',');
  const params = [entityType, String(entityId), ...REVIEW_LOCKING_STATUSES];
  let exclusion = '';
  if (allowReviewId) { exclusion = ' AND operational_review_id <> ?'; params.push(Number(allowReviewId)); }
  const [rows] = await connection.query(
    `SELECT operational_review_id,review_number,status FROM operational_reviews WHERE entity_type=? AND entity_id=? AND status IN (${statuses})${exclusion} ORDER BY operational_review_id DESC LIMIT 1`, params
  );
  if (rows[0]) throw Object.assign(new Error(`This record is locked by ${rows[0].review_number || `Review #${rows[0].operational_review_id}`} (${rows[0].status.replaceAll('_',' ')}).`), { statusCode: 409, code: 'REVIEW_LOCKED', review: rows[0] });
  return true;
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
