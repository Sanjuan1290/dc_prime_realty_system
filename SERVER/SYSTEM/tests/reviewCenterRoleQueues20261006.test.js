import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('Review Center includes Department Staff with correction-scoped access', () => {
  const router = read('SERVER/SYSTEM/routers/System/workflow.routers.js');
  const layout = read('CLIENT/SYSTEM/src/layout/SystemLayout.jsx');
  const details = read('CLIENT/SYSTEM/src/pages/System/ReviewDetailsPage.jsx');
  const badge = read('CLIENT/SYSTEM/src/utils/useWorkflowBadge.js');
  for (const role of [
    'super_admin','system_admin','auditor',
    'marketing_head','sales_head','accounting_head','operations_head',
    'marketing_staff','sales_staff','accounting_staff','operations_staff',
  ]) {
    assert.match(router, new RegExp(role));
    assert.match(layout, new RegExp(role));
    assert.match(details, new RegExp(role));
    assert.match(badge, new RegExp(role));
  }
});

test('role queues are action-specific and Staff receive only their own returned corrections', () => {
  const controller = read('SERVER/SYSTEM/controllers/System/workflow.controller.js');
  assert.match(controller, /role === 'auditor'[\s\S]*pending_auditor_review/);
  assert.match(controller, /role === 'system_admin'[\s\S]*correction_required/);
  assert.match(controller, /\['system_admin','super_admin'\]\.includes\(role\)/);
  assert.match(controller, /getAuditCorrectionRole\(review\)/);
  assert.match(controller, /DEPARTMENT_STAFF_ROLES\.includes\(role\)[\s\S]*status='returned_for_correction'[\s\S]*initiated_by_user_id=\?/);
  assert.match(controller, /review\.status === 'returned_for_correction'[\s\S]*review\.initiated_by_user_id[\s\S]*actor\.id/);
  assert.match(controller, /department=\?[\s\S]*pending_head_review/);
  assert.match(controller, /const canAct = await canActorOpenReview/);
  assert.match(controller, /canActorViewReview/);
  assert.match(controller, /viewer: \{ canAct, readOnly: !canAct \}/);
});

test('Staff recommended defaults include Review Center view but no reviewer permissions', () => {
  const recommended = read('SERVER/SYSTEM/config/recommendedRolePermissions.js');
  for (const role of ['marketing_staff','sales_staff','accounting_staff','operations_staff']) {
    const start = recommended.indexOf(`${role}: Object.freeze([`);
    assert.ok(start >= 0, role);
    const block = recommended.slice(start, recommended.indexOf(']),', start) + 3);
    assert.match(block, /WORKFLOW_REVIEW_CENTER_VIEW/, role);
    assert.doesNotMatch(block, /WORKFLOW_DEPARTMENT_REVIEW|WORKFLOW_AUDIT_REVIEW|WORKFLOW_SYSTEM_CORRECTION_APPLY/, role);
  }
});

test('returned correction UI tells Staff why it was returned and how to resubmit', () => {
  const center = read('CLIENT/SYSTEM/src/pages/System/ReviewCenter.jsx');
  assert.match(center, /Returned Requests/);
  assert.match(center, /Correction required — action needed/);
  assert.match(center, /What needs to be corrected/);
  assert.match(center, /latestCorrectionRequest\.message/);
  assert.match(center, /Correct &amp; Resubmit/);
  assert.match(center, /Return & Notify Staff/);
  assert.match(center, /ReviewInformationDialog/);
});





