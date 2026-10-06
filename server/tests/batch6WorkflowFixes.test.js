import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertEntityNotReviewLocked,
  buildReviewPayloadHash,
  createOperationalReview,
} from '../services/operationalReview.service.js';
import { resolveAuditCaseResponders } from '../services/auditCaseResponder.service.js';
import { authorizeGovernedAction } from '../services/governedAction.service.js';
import { REVIEW_ACTIONS } from '../config/reviewActions.js';

const readProjectFile = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

// Minimal mysql2-style fake: each handler is [regex, (sql, params) => result].
const fakeConnection = (handlers = []) => {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      for (const [pattern, respond] of handlers) {
        if (pattern.test(sql)) return respond(sql, params);
      }
      if (/^\s*INSERT/i.test(sql)) return [{ insertId: 41 }];
      if (/^\s*UPDATE|^\s*DELETE/i.test(sql)) return [{ affectedRows: 1 }];
      return [[]];
    },
  };
};
const withApprovalTypeColumn = [/information_schema\.COLUMNS/, () => [[{ 1: 1 }]]];

test('every registered review action names a valid department and entity', () => {
  for (const [key, definition] of Object.entries(REVIEW_ACTIONS)) {
    assert.ok(['marketing', 'sales', 'accounting', 'operations'].includes(definition.department), key);
    assert.ok(definition.entityType, key);
    assert.ok(definition.label, key);
  }
});

test('every actionKey used in the code is registered', async () => {
  const sources = await Promise.all([
    'server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js',
    'server/controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js',
    'server/controllers/Lot_Projects/ListingProfile/ReservationCorrection.controller.js',
    'server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js',
    'server/controllers/Lot_Projects/ListingProfile/ClientProfile.controller.js',
    'server/controllers/Lot_Projects/BuyerForms/BuyerForms.controller.js',
    'server/controllers/Lot_Projects/Commissions/Commissions.controller.js',
    'server/controllers/Lot_Projects/ListingProfile/PaymentProofs.controller.js',
    'server/controllers/Lot_Projects/ListingProfile/SignedAcknowledgement.controller.js',
    'server/controllers/Lot_Projects/ListingProfile/Documents.controller.js',
    'server/controllers/Lot_Projects/Listings/Listings.controller.js',
    'server/controllers/Lot_Projects/Listings/ListingImports.controller.js',
    'server/controllers/System/sellerGroup.controller.js',
    'server/controllers/System/users.controllers.js',
    'server/controllers/Lot_Projects/Settings/Settings.controller.js',
  ].map(readProjectFile));
  const keys = new Set(sources.join('\n').match(/actionKey: '([a-z_.]+)'/g)?.map((match) => match.slice(12, -1)) || []);
  keys.add('payment.edit'); keys.add('payment.void'); keys.add('reservation.correct_unit'); keys.add('project.settings.update');
  for (const key of keys) assert.ok(REVIEW_ACTIONS[key], `${key} is not registered`);
});

test('unregistered review actions are rejected', async () => {
  const connection = fakeConnection([withApprovalTypeColumn]);
  await assert.rejects(
    createOperationalReview(connection, { actor: { id: 1, role: 'accounting_staff' }, actionKey: 'payment.mystery', department: 'accounting', entityType: 'x', entityId: 1 }),
    /not registered/
  );
  await assert.rejects(
    createOperationalReview(connection, { actor: { id: 1, role: 'sales_staff' }, actionKey: 'payment.create', department: 'sales', entityType: 'x', entityId: 1 }),
    /belongs to accounting/
  );
});

test('Super Admin emergency change goes to the Auditor without a fake Head reviewer', async () => {
  const connection = fakeConnection([withApprovalTypeColumn]);
  const result = await createOperationalReview(connection, {
    actor: { id: 9, role: 'super_admin' }, actionKey: 'payment.edit', department: 'accounting',
    entityType: 'lot_project_payment', entityId: 5, headPreApprovedByUserId: 9,
  });
  assert.equal(result.status, 'pending_auditor_review');
  assert.equal(result.approvalType, 'emergency_super_admin');
  const insert = connection.calls.find((call) => /INSERT INTO operational_reviews/.test(call.sql));
  assert.equal(insert.params[11], null, 'head_reviewed_by_user_id must be null');
  assert.equal(insert.params.at(-1), 'emergency_super_admin');
});

test('Head change on a record with an open Staff review becomes Correct & Confirm', async () => {
  const open = { operational_review_id: 77, review_number: 'REV-00000077', status: 'pending_head_review', claimed_by_user_id: null, initiated_by_user_id: 3, after_snapshot_json: { amount: 100 } };
  const connection = fakeConnection([
    withApprovalTypeColumn,
    [/FROM operational_reviews\s+WHERE entity_type = \? AND entity_id = \? AND department = \?/, () => [[open]]],
  ]);
  const result = await createOperationalReview(connection, {
    actor: { id: 4, role: 'accounting_head' }, actionKey: 'payment.edit', department: 'accounting',
    entityType: 'lot_project_payment', entityId: 5, afterSnapshot: { amount: 120 },
  });
  assert.deepEqual([result.reviewId, result.status, result.headCorrected], [77, 'pending_auditor_review', true]);
  assert.ok(connection.calls.some((call) => /approval_type = 'head_corrected'/.test(call.sql)));
  assert.ok(!connection.calls.some((call) => /INSERT INTO operational_reviews/.test(call.sql)), 'no second review');
});

test('routine post-action Head/Auditor reviews do not lock the record; correction cases still do', async () => {
  const routine = fakeConnection([[
    /FROM operational_reviews WHERE entity_type=\?/,
    (_sql, params) => [params.includes('pending_head_review') || params.includes('pending_auditor_review')
      ? [{ operational_review_id: 1, review_number: 'REV-1', status: 'pending_auditor_review', department: 'accounting' }]
      : []],
  ]]);
  assert.equal(await assertEntityNotReviewLocked(routine, { entityType: 'p', entityId: 1, actor: { id: 3, role: 'accounting_staff' } }), true);

  const correction = fakeConnection([[
    /FROM operational_reviews WHERE entity_type=\?/,
    () => [[{ operational_review_id: 2, review_number: 'REV-2', status: 'correction_required', department: 'accounting' }]],
  ]]);
  await assert.rejects(
    assertEntityNotReviewLocked(correction, { entityType: 'p', entityId: 1, actor: { id: 3, role: 'accounting_staff' } }),
    /REV-2 has an active controlled correction/
  );
});

test('Audit Case responders: emergency, original Head, fallback, reassigned', async () => {
  const connection = fakeConnection([
    [/role = 'super_admin'/, () => [[{ id: 9 }]]],
    [/WHERE u\.role = \? AND u\.status = 'active'/, () => [[{ id: 4 }, { id: 5 }]]],
    [/WHERE id = \? AND status = 'active'/, (_sql, params) => [params[0] === 6 ? [{ id: 6 }] : []]],
  ]);
  assert.deepEqual(await resolveAuditCaseResponders(connection, { approval_type: 'emergency_super_admin', department: 'accounting' }), { mode: 'emergency_super_admin', userIds: [9], originalHeadUserId: null });
  assert.equal((await resolveAuditCaseResponders(connection, { department: 'accounting', head_reviewed_by_user_id: 4 })).mode, 'original_head');
  const fallback = await resolveAuditCaseResponders(connection, { department: 'accounting', head_reviewed_by_user_id: 99 });
  assert.deepEqual([fallback.mode, fallback.userIds], ['department_head_fallback', [4, 5]]);
  assert.deepEqual((await resolveAuditCaseResponders(connection, { department: 'accounting', head_reviewed_by_user_id: 4, assigned_responder_user_id: 6 })).userIds, [6]);
});

test('Governed actions: Head direct, Super Admin emergency, Staff files a request then applies after approval', async () => {
  const base = { actionKey: 'cancellation.start', projectId: 1, entityId: 20, entityLabel: 'LA-0101', payload: { action: 'start_cancellation', actorId: 3 } };
  const head = await authorizeGovernedAction(fakeConnection(), { ...base, actor: { id: 4, role: 'sales_head' } });
  assert.deepEqual([head.authorized, head.authorizationType, head.headPreApprovedByUserId, head.department], [true, 'department_head', 4, 'sales']);
  const emergency = await authorizeGovernedAction(fakeConnection(), { ...base, actor: { id: 9, role: 'super_admin' } });
  assert.equal(emergency.authorizationType, 'emergency_super_admin');

  const pending = await authorizeGovernedAction(fakeConnection(), { ...base, actor: { id: 3, role: 'sales_staff' } });
  assert.equal(pending.authorized, false);
  assert.equal(pending.pending.status, 'pending');

  const hash = buildReviewPayloadHash(base.payload);
  const approvedRow = {
    protected_change_request_id: 12, request_number: 'APR-00000012', status: 'approved', requested_by_user_id: 3,
    action_key: 'cancellation.start', entity_type: 'lot_project_cancellation', entity_id: '20',
    request_payload_hash: hash, expires_at: new Date(Date.now() + 3600_000), reviewed_by_head_user_id: 4,
  };
  const approvedConnection = fakeConnection([
    [/status IN \('pending','approved'\)/, () => [[approvedRow]]],
    [/WHERE protected_change_request_id=\? LIMIT 1 FOR UPDATE/, () => [[approvedRow]]],
  ]);
  const applied = await authorizeGovernedAction(approvedConnection, { ...base, actor: { id: 3, role: 'sales_staff' } });
  assert.deepEqual([applied.authorized, applied.authorizationType, applied.headPreApprovedByUserId], [true, 'head_approval', 4]);
  assert.ok(approvedConnection.calls.some((call) => /status='used'/.test(call.sql)));
});

test('Cancellations and reserved/sold edits are wired to Head approval and the Auditor', async () => {
  const listings = await readProjectFile('server/controllers/Lot_Projects/Listings/Listings.controller.js');
  assert.match(listings, /cancellationReviewActionKey\(statusTransitionAction\)/);
  assert.match(listings, /governedActionKey = 'listing\.protected_edit'/);
  assert.match(listings, /createOperationalReview\(connection, \{[\s\S]*actionKey: governedActionKey/);
  assert.match(listings, /consume: false/);
});

test('Review Center makes post-action checks explicit and keeps correction controls', async () => {
  const page = await readProjectFile('client/src/pages/System/ReviewCenter.jsx');
  assert.match(page, /Completed · Head Check Pending/);
  assert.match(page, /Completed · Auditor Check Pending/);
  assert.match(page, /Operation saved successfully/);
  assert.match(page, /does not block normal work/);
  assert.match(page, /Super Admin direct entry/);
  assert.match(page, /Correct &amp; Confirm/);
  assert.match(page, /reassign-responder/);
  assert.match(page, /responders\?\.canRespond/);
  assert.match(page, /approvalStatus/);
});
