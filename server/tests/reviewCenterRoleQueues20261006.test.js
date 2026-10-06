import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Review Center is restricted to owners, Auditor and Department Heads', () => {
  const router = read('server/routers/System/workflow.routers.js');
  const layout = read('client/src/layout/SystemLayout.jsx');
  for (const role of ['super_admin','system_admin','auditor','marketing_head','sales_head','accounting_head','operations_head']) {
    assert.match(router, new RegExp(role));
    assert.match(layout, new RegExp(role));
  }
  for (const role of ['marketing_staff','sales_staff','accounting_staff','operations_staff']) {
    assert.doesNotMatch(router.match(/REVIEW_CENTER_ROLES[\s\S]*?\]\);/)?.[0] || '', new RegExp(role));
  }
});

test('role queues are action-specific', () => {
  const controller = read('server/controllers/System/workflow.controller.js');
  assert.match(controller, /role === 'auditor'[\s\S]*pending_auditor_review[\s\S]*pending_auditor_recheck/);
  assert.match(controller, /role === 'system_admin'[\s\S]*correction_required/);
  assert.match(controller, /role === 'super_admin'[\s\S]*emergency_super_admin/);
  assert.match(controller, /pending_head_review[\s\S]*awaiting_head_response/);
  // Acting stays role-specific; viewing a past or moved-on review is read-only.
  assert.match(controller, /const canAct = await canActorOpenReview/);
  assert.match(controller, /canActorViewReview/);
  assert.match(controller, /viewer: \{ canAct, readOnly: !canAct \}/);
});

test('Staff defaults do not include Review Center', () => {
  const recommended = read('server/config/recommendedRolePermissions.js');
  const policy = read('server/config/rolePolicies.js');
  assert.doesNotMatch(recommended, /marketing_staff:\s*Object\.freeze\([^\n]*WORKFLOW_REVIEW_CENTER_VIEW/);
  assert.match(policy, /const staffBaseline = \[\]/);
});


