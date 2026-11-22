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

const readProjectFile = (relativePath) => readFile(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');

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

test('A later Staff operation creates a separate review before Head checking', async () => {
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

  assert.equal(result.reviewId, 91);
  assert.equal(result.status, 'pending_head_review');
  assert.equal(result.refreshed, undefined);
  assert.ok(!connection.calls.some((call) => /revision=revision\+1/.test(call.sql)));
  assert.ok(connection.calls.some((call) => /INSERT INTO operational_reviews/.test(call.sql)), 'one review per operation');
  assert.ok(!connection.calls.some((call) => /record_updated_before_head_check/.test(String(call.params))));
});

test('A later Staff operation creates a separate review without reopening prior evidence', async () => {
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
  assert.equal(result.reviewId, 91);
  assert.equal(result.status, 'pending_head_review');
  assert.equal(result.reopenedForHeadReview, undefined);
  assert.ok(!connection.calls.some((call) => /record_changed_after_head_check/.test(String(call.params))));
});

test('returned reviews and active Audit Cases never lock edits', async () => {
  const connection = fakeConnection([[ /FROM operational_reviews WHERE entity_type=\?/, () => { throw new Error('No lock query should run.'); } ]]);
  for (const stage of ['returned_for_correction', 'audit_case_open', 'correction_required', 'pending_auditor_recheck']) {
    assert.equal(await assertEntityNotReviewLocked(connection, { entityType: 'seller_group', entityId: 8, stage }), true);
  }
  assert.equal(connection.calls.length, 0);
});

test("Audit correction authorization enforces assignment for both owner roles", async()=>{
 const row={audit_case_id:4,operational_review_id:9,status:'pending_system_admin_correction',review_status:'correction_required',entity_type:'seller_group',entity_id:'8',assigned_responder_user_id:2,opened_by_auditor_user_id:8};
 const connection=fakeConnection([[/FROM audit_cases c/,()=>[[row]]]]);
 const args={auditCaseId:4,entityType:'seller_group',entityId:8,correctionReason:'Supported by saved evidence.'};
 for(const role of ['system_admin','super_admin'])assert.ok(await getPendingAuditCorrectionCase(connection,{...args,actor:{id:2,role}}));
 await assert.rejects(getPendingAuditCorrectionCase(connection,{...args,actor:{id:1,role:'super_admin'}}),{statusCode:403});
 await assert.rejects(getPendingAuditCorrectionCase(connection,{...args,actor:{id:2,role:'system_admin'},correctionReason:''}),{statusCode:400});
});

test('Review Center explains correction ownership and gives original Staff a Correct & Resubmit action', async () => {
  const page = await readProjectFile('CLIENT/SYSTEM/src/pages/System/ReviewCenter.jsx');
  assert.match(page, /Returned for Correction/);
  assert.match(page, /Correct &amp; Resubmit/);
  assert.match(page, /Auditor-confirmed correction required/);
  assert.match(page, /correctionRoleLabel/);
  assert.match(page, /An open Audit Case does not prevent permitted changes/);
});






