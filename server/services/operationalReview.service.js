import { isOwnerAdministrator } from '../config/permissions.js';
import crypto from 'node:crypto';
import { DEPARTMENT_HEAD_ROLE, getRoleDepartment } from '../config/permissions.js';
import { createInternalNotifications, notifyAuditors, notifyDepartmentHeads, settleReviewNotifications } from './internalNotification.service.js';
import { assertRegisteredReviewAction, getReviewActionLabel } from '../config/reviewActions.js';

// Operational reviews and Audit Cases are evidence/review queues, not record locks.
// Access controls and protected pre-approvals still apply to the underlying action.
// Keep this exported constant for compatibility with callers and existing tests.
export const REVIEW_LOCKING_STATUSES = Object.freeze([]);

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
  // Every stage change is recorded through this event. Settle action
  // notifications that belong to the previous stage so other accounts stop
  // seeing work that was already done or is no longer assigned to them.
  if (toStatus || fromStatus) {
    try { await settleReviewNotifications(connection, reviewId); } catch { /* notifications are best-effort */ }
  }
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


const notifyInitiatorReviewState = async (connection, {
  actor,
  reviewId,
  link = '/portal/review-center',
  title,
  message,
}) => {
  if (!Number(actor?.id || 0)) return [];
  return createInternalNotifications(connection, {
    userIds: [actor.id],
    type: 'post_action_review_status',
    title,
    message,
    reviewId,
    link,
  });
};

/**
 * Audit Case evidence stays visible even if someone edits the record while a
 * case is open. Do not change the case state, reviewer assignments or routing.
 * Review events retain the editor, timestamp, and before/after snapshots; the
 * normal business controller also records the change in system Audit Logs.
 */
const recordChangeDuringOpenAuditCase = async (connection, {
  actor, actionKey, entityType, entityId, beforeSnapshot, afterSnapshot,
}) => {
  const [rows] = await connection.query(
    `SELECT c.audit_case_id, c.case_number, r.operational_review_id
     FROM audit_cases c
     INNER JOIN operational_reviews r ON r.operational_review_id=c.operational_review_id
     WHERE r.entity_type=? AND r.entity_id=?
       AND c.status IN ('awaiting_head_response','under_auditor_review',
         'pending_system_admin_correction','pending_auditor_recheck')`,
    [entityType, String(entityId)]
  );
  for (const auditCase of rows) {
    await appendReviewEvent(connection, {
      reviewId: auditCase.operational_review_id,
      eventType: 'record_changed_during_audit_case',
      actor,
      message: `${getReviewActionLabel(actionKey)} was saved while ${auditCase.case_number || 'an Audit Case'} was active. Check the newer values and Audit Logs before resolving the finding.`,
      metadata: { auditCaseId: auditCase.audit_case_id, actionKey, beforeSnapshot, afterSnapshot },
    });
  }
};

/**
 * If the same user changes the same record again before its routine review is
 * finished, keep one Review number and move its snapshot forward instead of
 * creating a pile of stale Reviews.
 *
 * - Staff/System Admin change before Head check: stay pending Head check.
 * - Staff/System Admin change after Head check but before audit: reopen Head check.
 * - Department Head/Super Admin change before audit: keep the same audit queue.
 *
 * The original before-snapshot stays untouched. Every refresh is appended to the
 * immutable event history so reviewers can see how the record evolved.
 */
const refreshOwnRoutineReview = async (connection, {
  actor,
  actionKey,
  department,
  projectId = null,
  entityType,
  entityId,
  entityLabel = null,
  afterSnapshot = null,
  link = '/portal/review-center',
}) => {
  const [rows] = await connection.query(
    `SELECT * FROM operational_reviews
     WHERE entity_type=? AND entity_id=? AND department=? AND initiated_by_user_id=?
       AND status IN ('pending_head_review','pending_auditor_review')
     ORDER BY operational_review_id DESC LIMIT 1 FOR UPDATE`,
    [entityType, String(entityId), department, actor.id]
  );
  const open = rows[0];
  if (!open) return null;

  const expectedHeadRole = DEPARTMENT_HEAD_ROLE[department];
  const isDepartmentHead = actor.role === expectedHeadRole;
  const isSuperAdmin = isOwnerAdministrator(actor);
  const fromStatus = open.status;
  const previousAfterSnapshot = open.after_snapshot_json ?? null;
  const previousActionKey = open.action_key;

  let nextStatus = 'pending_head_review';
  let approvalType = REVIEW_APPROVAL_TYPES.STAFF_ENTRY;
  let headReviewerId = null;
  let eventType = fromStatus === 'pending_auditor_review'
    ? 'record_changed_after_head_check'
    : 'record_updated_before_head_check';
  let eventMessage = fromStatus === 'pending_auditor_review'
    ? `${getReviewActionLabel(actionKey)} changed the record after the previous Department Head check. Head review was reopened for the latest values.`
    : `${getReviewActionLabel(actionKey)} updated the record before Department Head review. The same review now shows the latest values.`;

  if (isSuperAdmin) {
    nextStatus = 'pending_auditor_review';
    approvalType = REVIEW_APPROVAL_TYPES.EMERGENCY_SUPER_ADMIN;
    eventType = 'super_admin_updated_before_audit';
    eventMessage = `${getReviewActionLabel(actionKey)} updated the record before independent audit. The operation remains complete and the Auditor will review the latest values.`;
  } else if (isDepartmentHead) {
    nextStatus = 'pending_auditor_review';
    approvalType = REVIEW_APPROVAL_TYPES.HEAD_SELF;
    headReviewerId = actor.id;
    eventType = 'head_updated_before_audit';
    eventMessage = `${getReviewActionLabel(actionKey)} updated the record before independent audit. Department self-review is complete and the Auditor will review the latest values.`;
  }

  const withType = await hasApprovalTypeColumn(connection);
  await connection.query(
    `UPDATE operational_reviews
     SET action_key=?,
         lot_project_id=COALESCE(?,lot_project_id),
         entity_label=COALESCE(?,entity_label),
         after_snapshot_json=?,
         revision=revision+1,
         status=?,
         claimed_by_user_id=?, claimed_at=?,
         head_reviewed_by_user_id=?, head_reviewed_at=?,
         auditor_reviewed_by_user_id=NULL, auditor_reviewed_at=NULL
         ${withType ? ', approval_type=?' : ''}
     WHERE operational_review_id=?`,
    [
      actionKey,
      projectId || null,
      entityLabel,
      jsonValue(afterSnapshot),
      nextStatus,
      headReviewerId,
      headReviewerId ? new Date() : null,
      headReviewerId,
      headReviewerId ? new Date() : null,
      ...(withType ? [approvalType] : []),
      open.operational_review_id,
    ]
  );

  await appendReviewEvent(connection, {
    reviewId: open.operational_review_id,
    eventType,
    actor,
    fromStatus,
    toStatus: nextStatus,
    message: eventMessage,
    metadata: {
      previousActionKey,
      latestActionKey: actionKey,
      previousAfterSnapshot,
      reviewRevision: Number(open.revision || 1) + 1,
    },
  });

  if (nextStatus === 'pending_head_review') {
    await notifyDepartmentHeads(connection, {
      department,
      projectId: projectId || open.lot_project_id || null,
      reviewId: open.operational_review_id,
      title: `Post-action review updated · ${entityLabel || open.entity_label || entityType}`,
      message: `${open.review_number} has newer saved values. Review the latest version; the operation is already complete.`,
    });
    await notifyInitiatorReviewState(connection, {
      actor,
      reviewId: open.operational_review_id,
      link,
      title: 'Saved successfully · Head check queued',
      message: `${open.review_number} was updated to the latest saved values. You may continue normal work while the ${department} Head checks it.`,
    });
  } else {
    await notifyAuditors(connection, {
      reviewId: open.operational_review_id,
      title: `Post-action audit updated · ${entityLabel || open.entity_label || entityType}`,
      message: `${open.review_number} has newer saved values. Review the latest version; the operation is already complete.`,
    });
    await notifyInitiatorReviewState(connection, {
      actor,
      reviewId: open.operational_review_id,
      link,
      title: 'Saved successfully · Auditor check queued',
      message: `${open.review_number} now contains the latest saved values and remains queued for independent audit.`,
    });
  }

  return {
    reviewId: Number(open.operational_review_id),
    reviewNumber: open.review_number,
    status: nextStatus,
    approvalType,
    refreshed: true,
    reopenedForHeadReview: fromStatus === 'pending_auditor_review' && nextStatus === 'pending_head_review',
  };
};

/**
 * Head "Correct & Confirm" (plan item 15): when a Department Head changes a
 * record that still has an open Staff review (pending Head review or returned
 * for correction), the Head's change is folded into THAT review instead of
 * opening a second one. The Staff values stay in the event history, the Head
 * becomes the reviewer, and the review goes straight to the Auditor.
 */
const absorbOpenStaffReviewIntoHeadCorrection = async (connection, {
  actor, actionKey, department, projectId = null, entityType, entityId, entityLabel, beforeSnapshot, afterSnapshot,
}) => {
  const [rows] = await connection.query(
    `SELECT * FROM operational_reviews
     WHERE entity_type = ? AND entity_id = ? AND department = ?
       AND status = 'pending_head_review'
     ORDER BY operational_review_id DESC LIMIT 1 FOR UPDATE`,
    [entityType, String(entityId), department]
  );
  const open = rows[0];
  if (!open) return null;
  const withType = await hasApprovalTypeColumn(connection);
  await connection.query(
    `UPDATE operational_reviews
     SET action_key = ?,
         lot_project_id = COALESCE(?, lot_project_id),
         entity_label = COALESCE(?, entity_label),
         status = 'pending_auditor_review',
         revision = revision + 1,
         after_snapshot_json = ?,
         claimed_by_user_id = ?, claimed_at = COALESCE(claimed_at, NOW()),
         head_reviewed_by_user_id = ?, head_reviewed_at = NOW()${withType ? ", approval_type = 'head_corrected'" : ''}
     WHERE operational_review_id = ?`,
    [actionKey, projectId || null, entityLabel, jsonValue(afterSnapshot), actor.id, actor.id, open.operational_review_id]
  );
  await appendReviewEvent(connection, {
    reviewId: open.operational_review_id,
    eventType: 'head_corrected_and_confirmed',
    actor,
    fromStatus: open.status,
    toStatus: 'pending_auditor_review',
    message: `${getReviewActionLabel(actionKey)} corrected by the Department Head and confirmed for audit.`,
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

  const isEmergency = isOwnerAdministrator(actor);
  const isDepartmentHead = actor.role === expectedHeadRole;
  const preApprovedHeadId = isEmergency ? 0 : Number(headPreApprovedByUserId || 0);

  if (isDepartmentHead) {
    const absorbed = await absorbOpenStaffReviewIntoHeadCorrection(connection, {
      actor, actionKey, department, projectId, entityType, entityId, entityLabel, beforeSnapshot, afterSnapshot,
    });
    if (absorbed) {
      await recordChangeDuringOpenAuditCase(connection, { actor, actionKey, entityType, entityId, beforeSnapshot, afterSnapshot });
      return absorbed;
    }
  }

  const refreshed = await refreshOwnRoutineReview(connection, {
    actor, actionKey, department, projectId, entityType, entityId, entityLabel, afterSnapshot, link,
  });
  if (refreshed) {
    await recordChangeDuringOpenAuditCase(connection, { actor, actionKey, entityType, entityId, beforeSnapshot, afterSnapshot });
    return refreshed;
  }

  // Super Admin direct entries skip Department Head self-review and go straight
  // to independent audit. The persisted approval_type value is retained for
  // backward compatibility with existing Audit Case responder logic.
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
    message: `${getReviewActionLabel(actionKey)} saved and queued for review.`,
    metadata: { approvalType },
  });

  if (initialStatus === 'pending_auditor_review') {
    const message = {
      [REVIEW_APPROVAL_TYPES.EMERGENCY_SUPER_ADMIN]: `${number} was entered directly by Super Admin. The operation is already complete and is queued for independent audit.`,
      [REVIEW_APPROVAL_TYPES.HEAD_PREAPPROVED]: `${number} was completed after Department Head approval and is queued for independent audit.`,
      [REVIEW_APPROVAL_TYPES.HEAD_SELF]: `${number} was completed by the ${expectedHeadRole.replaceAll('_',' ')} and is queued for independent audit.`,
    }[approvalType];
    await notifyAuditors(connection, { reviewId, title: `Post-action audit queued · ${entityLabel || entityType}`, message });
  } else {
    const recipients = await notifyDepartmentHeads(connection, { department, projectId, reviewId, title: `Post-action department check queued · ${entityLabel || entityType}`, message: `${number} is already completed and is waiting for the ${department} Head's post-action check.` });
    if (!recipients.length) {
      const [adminRows] = await connection.query("SELECT id FROM users WHERE role='system_admin' AND status='active'");
      await createInternalNotifications(connection, { userIds: adminRows.map((row) => row.id), type: 'review_has_no_head', title: `No ${department} Head available`, message: `${number} has no eligible Head for this project. Assign Head coverage.`, reviewId, link });
    }
  }

  await notifyInitiatorReviewState(connection, {
    actor,
    reviewId,
    link,
    title: initialStatus === 'pending_head_review'
      ? 'Saved successfully · Head check queued'
      : 'Saved successfully · Auditor check queued',
    message: initialStatus === 'pending_head_review'
      ? `${number} is a post-action review. Your change is already active; the ${department} Head will check it in the background.`
      : `${number} is a post-action review. Your change is already active and is queued for independent Auditor verification.`,
  });

  await recordChangeDuringOpenAuditCase(connection, { actor, actionKey, entityType, entityId, beforeSnapshot, afterSnapshot });
  return { reviewId, reviewNumber: number, status: initialStatus, approvalType };
};

export const getOperationalReviewForUpdate = async (connection, reviewId) => {
  const [rows] = await connection.query('SELECT * FROM operational_reviews WHERE operational_review_id = ? LIMIT 1 FOR UPDATE', [Number(reviewId)]);
  return rows[0] || null;
};

/**
 * Deliberately non-blocking. A Head's returned correction or an active Audit
 * Case must NEVER prevent an otherwise authorized user from editing a record.
 * This compatibility entry point is still called by controllers, so switching
 * off locks here covers their existing update paths without weakening RBAC.
 * Row-level SQL FOR UPDATE locks used for transactional consistency remain.
 */
export const assertEntityNotReviewLocked = async (_connection, _options = {}) => true;

export const getReturnedOperationalReviewForActor = async (connection, {
  actor, actionKey, entityType, entityId, reviewId = null,
}) => {
  if (!actor?.id) return null;
  const params = [];
  const clauses = [
    "status='returned_for_correction'",
    'initiated_by_user_id=?',
    'action_key=?',
    'entity_type=?',
    'entity_id=?',
  ];
  params.push(actor.id, actionKey, entityType, String(entityId));
  if (reviewId) {
    clauses.unshift('operational_review_id=?');
    params.unshift(Number(reviewId));
  }
  const [rows] = await connection.query(
    `SELECT * FROM operational_reviews
     WHERE ${clauses.join(' AND ')}
     ORDER BY operational_review_id DESC LIMIT 1 FOR UPDATE`,
    params
  );
  return rows[0] || null;
};

export const resubmitReturnedOperationalReview = async (connection, {
  review, actor, department, projectId = null, entityLabel = null, beforeSnapshot = null, afterSnapshot = null, message = null,
}) => {
  if (!review?.operational_review_id || review.status !== 'returned_for_correction') {
    throw Object.assign(new Error('A returned Operational Review is required for resubmission.'), { statusCode: 409, code: 'RETURNED_REVIEW_REQUIRED' });
  }
  await connection.query(
    `UPDATE operational_reviews
     SET status='pending_head_review',
         revision=revision+1,
         before_snapshot_json=?,
         after_snapshot_json=?,
         claimed_by_user_id=NULL, claimed_at=NULL,
         head_reviewed_by_user_id=NULL, head_reviewed_at=NULL,
         auditor_reviewed_by_user_id=NULL, auditor_reviewed_at=NULL
     WHERE operational_review_id=? AND status='returned_for_correction'`,
    [jsonValue(beforeSnapshot), jsonValue(afterSnapshot), review.operational_review_id]
  );
  await appendReviewEvent(connection, {
    reviewId: review.operational_review_id,
    eventType: 'staff_correction_submitted',
    actor,
    fromStatus: 'returned_for_correction',
    toStatus: 'pending_head_review',
    message: message || `${getReviewActionLabel(review.action_key)} corrected and resubmitted for Head review.`,
  });
  await notifyDepartmentHeads(connection, {
    department,
    projectId,
    reviewId: review.operational_review_id,
    title: `Corrected record ready for Head review · ${review.review_number}`,
    message: `${entityLabel || review.entity_label || review.entity_type} was corrected by the original staff member. Please review the new values.`,
  });
  return {
    reviewId: Number(review.operational_review_id),
    reviewNumber: review.review_number,
    status: 'pending_head_review',
    resubmitted: true,
  };
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



