// D&C Prime Realty
// Head-approval gate for actions that used to need the Super Admin
// (plan items 18-19: reserved/sold listing edits and cancellations).
//
//   * The owning department's Head acts directly.
//   * System Admin acts directly as the day-to-day full administrator.
//   * Super Admin remains available as the owner fallback.
//   * Everyone else (Staff and other departments) needs an
//     approved Head request for the exact same change. The first attempt
//     files the request automatically and returns HEAD_APPROVAL_PENDING;
//     submitting the same change again after approval applies it.
//
// After the change is saved the caller records an Operational Review, so the
// Auditor is always notified.

import { DEPARTMENT_HEAD_ROLE } from '../config/permissions.js';
import { assertRegisteredReviewAction } from '../config/reviewActions.js';
import { consumeProtectedChange, createProtectedChangeRequest } from './protectedChange.service.js';

const DEPARTMENT_LABELS = Object.freeze({
  marketing: 'Marketing', sales: 'Sales', accounting: 'Accounting', operations: 'Operations',
});

/**
 * @param consume false = only check that an approval exists (used before an
 *   email code is sent); true = mark the approval as used (the actual save).
 * @returns {{ authorized: true, authorizationType, headPreApprovedByUserId, approvalRequestId? }
 *          | { authorized: false, pending: { requestId, requestNumber, status } }}
 */
export const authorizeGovernedAction = async (connection, {
  actor,
  actionKey,
  projectId = null,
  entityId,
  entityLabel = null,
  payload,
  reason = '',
  approvalRequestId = null,
  consume = true,
}) => {
  const definition = assertRegisteredReviewAction(actionKey);
  const { department, entityType } = definition;
  if (!actor?.id) throw Object.assign(new Error('Authentication is required.'), { statusCode: 401 });

  if (actor.role === 'system_admin') {
    return { authorized: true, authorizationType: 'system_admin_direct', headPreApprovedByUserId: null, department, entityType };
  }
  if (actor.role === 'super_admin') {
    return { authorized: true, authorizationType: 'emergency_super_admin', headPreApprovedByUserId: null, department, entityType };
  }
  if (actor.role === DEPARTMENT_HEAD_ROLE[department]) {
    return { authorized: true, authorizationType: 'department_head', headPreApprovedByUserId: actor.id, department, entityType };
  }

  let requestId = Number(approvalRequestId || 0) || null;
  if (!requestId) {
    const request = await createProtectedChangeRequest(connection, {
      actor,
      actionKey,
      department,
      projectId,
      entityType,
      entityId: String(entityId),
      entityLabel,
      payload,
      reason: String(reason || '').trim().length >= 5 ? reason : `${definition.label}${entityLabel ? ` for ${entityLabel}` : ''}`,
    });
    if (request.status !== 'approved') {
      return {
        authorized: false,
        department,
        entityType,
        pending: { requestId: request.requestId, requestNumber: request.requestNumber, status: request.status },
      };
    }
    requestId = request.requestId;
  }

  if (!consume) {
    return { authorized: true, authorizationType: 'head_approval', approvalRequestId: requestId, headPreApprovedByUserId: null, department, entityType };
  }
  const approval = await consumeProtectedChange(connection, {
    requestId,
    actor,
    actionKey,
    entityType,
    entityId: String(entityId),
    payload,
  });
  return {
    authorized: true,
    authorizationType: 'head_approval',
    approvalRequestId: requestId,
    headPreApprovedByUserId: Number(approval.reviewed_by_head_user_id || 0) || null,
    department,
    entityType,
  };
};

export const headApprovalPendingResponse = (governance, definitionLabel) => {
  const departmentLabel = DEPARTMENT_LABELS[governance.department] || 'Department';
  const number = governance.pending?.requestNumber || 'An approval request';
  return {
    code: 'HEAD_APPROVAL_PENDING',
    message: `${number} was sent to the ${departmentLabel} Head for approval. Nothing was changed yet. After the Head approves, submit the same ${String(definitionLabel || 'change').toLowerCase()} again to apply it.`,
    data: { ...governance.pending, department: governance.department },
  };
};
