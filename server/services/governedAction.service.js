// D&C Prime Realty
// Governance helper for reviewable business actions.
//
//   * headApprovalBefore = true: Staff must obtain the owning Department Head's
//     approval before the exact change is saved.
//   * headApprovalBefore = false: the change is saved immediately and the caller
//     creates an Operational Review afterward for the Head to check.
//   * Department Heads, System Admin and Super Admin act directly.
//
// This keeps routine post-action checks non-blocking while preserving explicit
// pre-approval only for the small set of protected/destructive actions that need it.

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

  // Post-action reviews never block the save. Staff submits once, the business
  // change becomes active immediately, and createOperationalReview() routes the
  // saved result to the owning Department Head afterward.
  if (!definition.headApprovalBefore) {
    return { authorized: true, authorizationType: 'post_action_review', headPreApprovedByUserId: null, department, entityType };
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

