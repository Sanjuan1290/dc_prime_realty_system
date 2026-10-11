import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertEntityNotReviewLocked,
  createOperationalReview,
} from '../services/operationalReview.service.js';
import {
  getAuditCorrectionRole,
  getPendingAuditCorrectionCase,
} from '../services/auditCaseAuthorization.service.js';

const readProjectFile = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

const fakeConnection = (handlers = []) => {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      for (const [pattern, respond] of handlers) {
        if (pattern.test(sql)) return respond(sql, params);
      }
      if (/^\s*INSERT/i.test(sql)) return [{ insertId: 91 }];
      if (/^\s*UPDATE|^\s*DELETE/i.test(sql)) return [{ affectedRows: 1 }];
      return [[]];
    },
  };
};

const approvalTypeColumn = [/information_schema\.COLUMNS/, () => [[{ ok: 1 }]]];

test('same Staff edit before Head check refreshes the existing Review instead of creating a duplicate', async () => {
  const open = {
    operational_review_id: 44,
    review_number: 'REV-00000044',
    action_key: 'network.create',
    department: 'marketing',
    lot_project_id: null,
    entity_type: 'seller_group',
    entity_id: '8',
    entity_label: 'North Star Network',
    initiated_by_user_id: 7,
    status: 'pending_head_review',
    revision: 1,
    after_snapshot_json: { name: 'North Star Network' },
  };
  const connection = fakeConnection([
    approvalTypeColumn,
    [/initiated_by_user_id=\?\s+AND status IN \('pending_head_review','pending_auditor_review'\)/, () => [[open]]],
  ]);

  const result = await createOperationalReview(connection, {
    actor: { id: 7, role: 'marketing_staff' },
    actionKey: 'network.edit',
    department: 'marketing',
    entityType: 'seller_group',
    entityId: 8,
    entityLabel: 'North Star Network',
    afterSnapshot: { name: 'North Star Network', status: 'active' },
  });

  assert.equal(result.reviewId, 44);
  assert.equal(result.status, 'pending_head_review');
  assert.equal(result.refreshed, true);
  assert.ok(connection.calls.some((call) => /revision=revision\+1/.test(call.sql)));
  assert.ok(!connection.calls.some((call) => /INSERT INTO operational_reviews/.test(call.sql)), 'must reuse the open review');
  assert.ok(connection.calls.some((call) => /record_updated_before_head_check/.test(String(call.params))));
});

test('Staff edit after Head check reopens the same Review for Head review of the latest values', async () => {
  const open = {
    operational_review_id: 45,
    review_number: 'REV-00000045',
    action_key: 'network.edit',
    department: 'marketing',
    entity_type: 'seller_group',
    entity_id: '8',
    entity_label: 'North Star Network',
    initiated_by_user_id: 7,
    status: 'pending_auditor_review',
    revision: 2,
    after_snapshot_json: { status: 'active' },
  };
  const connection = fakeConnection([
    approvalTypeColumn,
    [/initiated_by_user_id=\?\s+AND status IN \('pending_head_review','pending_auditor_review'\)/, () => [[open]]],
  ]);
  const result = await createOperationalReview(connection, {
    actor: { id: 7, role: 'marketing_staff' },
    actionKey: 'network.edit', department: 'marketing', entityType: 'seller_group', entityId: 8,
    afterSnapshot: { status: 'inactive' },
  });
  assert.equal(result.reviewId, 45);
  assert.equal(result.status, 'pending_head_review');
  assert.equal(result.reopenedForHeadReview, true);
  assert.ok(connection.calls.some((call) => /record_changed_after_head_check/.test(String(call.params))));
});

test('returned reviews and active Audit Cases never lock edits', async () => {
  const connection = fakeConnection([[ /FROM operational_reviews WHERE entity_type=\?/, () => { throw new Error('No lock query should run.'); } ]]);
  for (const stage of ['returned_for_correction', 'audit_case_open', 'correction_required', 'pending_auditor_recheck']) {
    assert.equal(await assertEntityNotReviewLocked(connection, { entityType: 'seller_group', entityId: 8, stage }), true);
  }
  assert.equal(connection.calls.length, 0);
});

test('Audit correction owner is System Admin normally, but Super Admin for a Super Admin direct entry', async () => {
  assert.equal(getAuditCorrectionRole({ approval_type: 'staff_entry', initiated_by_role: 'marketing_staff' }), 'system_admin');
  assert.equal(getAuditCorrectionRole({ approval_type: 'emergency_super_admin', initiated_by_role: 'super_admin' }), 'super_admin');

  const superCase = {
    audit_case_id: 4,
    operational_review_id: 9,
    status: 'pending_system_admin_correction',
    entity_type: 'seller_group',
    entity_id: '8',
    approval_type: 'emergency_super_admin',
    initiated_by_role: 'super_admin',
  };
  const connection = fakeConnection([[/FROM audit_cases c/, () => [[superCase]]]]);
  await assert.rejects(
    getPendingAuditCorrectionCase(connection, { auditCaseId: 4, entityType: 'seller_group', entityId: 8, actor: { id: 2, role: 'system_admin' } }),
    /must be corrected by Super Admin/
  );
  const allowed = await getPendingAuditCorrectionCase(connection, { auditCaseId: 4, entityType: 'seller_group', entityId: 8, actor: { id: 1, role: 'super_admin' } });
  assert.equal(allowed.correction_role, 'super_admin');
});

test('Review Center explains correction ownership and gives original Staff a Correct & Resubmit action', async () => {
  const page = await readProjectFile('client/src/pages/System/ReviewCenter.jsx');
  assert.match(page, /Correction Requested · Staff Action Required/);
  assert.match(page, /Correct &amp; Resubmit/);
  assert.match(page, /Auditor-confirmed correction required/);
  assert.match(page, /correctionRoleLabel/);
  assert.match(page, /Authorized edits remain available during returned corrections and open Audit Cases/);
});


