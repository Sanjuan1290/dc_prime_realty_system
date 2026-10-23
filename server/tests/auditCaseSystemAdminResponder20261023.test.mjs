import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isAdminDirectAuditCase,
  resolveAuditCaseResponders,
  RESPONDER_MODE_LABELS,
} from '../services/auditCaseResponder.service.js';

const fakeConnection = (users = {}) => ({
  calls: [],
  async query(sql, params = []) {
    this.calls.push({ sql, params });
    if (sql.includes("u.role = 'system_admin'")) return [(users.activeAdmins || []).map((id) => ({ id }))];
    if (sql.includes("WHERE id = ? AND status = 'active'")) {
      return [users.reassignedId === params[0] ? [{ id: params[0] }] : []];
    }
    if (sql.includes('WHERE u.role = ?')) return [(users.heads || []).map((id) => ({ id }))];
    throw new Error(`Unexpected query: ${sql}`);
  },
});
const source = (relative) => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('Super Admin direct entry: System Admin must explain; never Super Admin by default', async () => {
  const db = fakeConnection({ activeAdmins: [22, 24] });
  const result = await resolveAuditCaseResponders(db, {
    approval_type: 'emergency_super_admin', initiated_by_role: 'super_admin',
    initiated_by_user_id: 1, lot_project_id: 30003,
  });
  assert.equal(isAdminDirectAuditCase({approval_type:'emergency_super_admin'}), true);
  assert.deepEqual(result, { mode: 'system_admin_case_responder', userIds: [22, 24], originalHeadUserId: null });
  assert.match(RESPONDER_MODE_LABELS[result.mode], /^System Admin/);
  assert.ok(db.calls.every(({ sql }) => !sql.includes("role = 'super_admin'")));
});

test('System Admin direct entry: initiating System Admin is preferred when eligible', async () => {
  const result = await resolveAuditCaseResponders(fakeConnection({ activeAdmins: [4, 5] }), {
    approval_type: 'emergency_super_admin', initiated_by_role: 'system_admin', initiated_by_user_id: 5,
  });
  assert.deepEqual(result.userIds, [5]);
  assert.equal(result.mode, 'initiating_system_admin');
});

test('Former system_admin_direct reviews also use the System Admin responder route', async () => {
  const result = await resolveAuditCaseResponders(fakeConnection({ activeAdmins: [9] }), {
    approval_type: 'system_admin_direct', initiated_by_role: 'system_admin', initiated_by_user_id: 77,
  });
  assert.deepEqual(result.userIds, [9]);
  assert.equal(result.mode, 'system_admin_fallback');
});

test('Explicitly reassigned responder is preserved; ordinary Head flow remains unchanged', async () => {
  const db = fakeConnection({activeAdmins:[20], heads:[7,8], reassignedId:31});
  const reassigned = await resolveAuditCaseResponders(db,{approval_type:'emergency_super_admin',assigned_responder_user_id:31});
  assert.deepEqual(reassigned.userIds,[31]);
  assert.equal(reassigned.mode, 'reassigned');
  const head = await resolveAuditCaseResponders(db,{approval_type:'head_confirmed',department:'accounting',head_reviewed_by_user_id:7});
  assert.equal(head.mode,'original_head');
  assert.deepEqual(head.userIds,[7]);
});

test('No active System Admin produces no false Super Admin assignment', async () => {
  const result = await resolveAuditCaseResponders(fakeConnection(), {
    approval_type:'emergency_super_admin',initiated_by_role:'super_admin'
  });
  assert.deepEqual(result.userIds, []);
  assert.equal(result.mode,'system_admin_case_responder');
});

test('UI labels, queue permissions, reassignment options, and notifications all use System Admin', () => {
  const controller = source('server/controllers/System/workflow.controller.js');
  const notifications = source('server/services/internalNotification.service.js');
  const ui = source('client/src/pages/System/ReviewCenter.jsx');
  const script = source('server/scripts/backfill-audit-case-system-admin-notifications.mjs');
  assert.match(controller,/isAdminDirectAuditCase\(review\) \? 'system_admin'/);
  assert.match(controller,/isAdminDirectAuditCase\(c\)\?'system_admin'/);
  assert.match(controller,/qac\.assigned_responder_user_id=\?/);
  assert.match(controller,/responders\.userIds\.includes\(Number\(req\.authUser\?\.id/);
  assert.match(notifications,/audit_case_response_required:[\s\S]*responder_user\.role = 'system_admin'/);
  assert.match(ui,/responders\.label/);
  assert.match(ui,/Awaiting System Admin Response/);
  assert.match(ui,/auditCaseStatusLabel\(auditCase, responders\)/);
  assert.match(script,/!present\.has\(id\)/);
  assert.match(script,/process\.argv\.includes\('--apply'\)/);
});
