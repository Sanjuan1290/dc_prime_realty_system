import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEPARTMENT_HEAD_ROLE, DEPARTMENT_STAFF_ROLES, getRoleDepartment } from '../config/permissions.js';
import {
  createOperationalReview, resubmitReturnedOperationalReview,
  assertEntityNotReviewLocked, getOperationalReviewForUpdate,
  appendReviewEvent, canActorSeeReview,
} from '../services/operationalReview.service.js';
import { createInternalNotifications, notifyAuditors, REVIEW_ACTION_NOTIFICATION_STAGES, activeNotificationSql } from '../services/internalNotification.service.js';

// Load real workflow controller logic with a fake DB, without needing a live
// MySQL server or optional server startup dependencies. Real service methods are
// still called; only external I/O is mocked.
const loadHandlers = (db, auditWrites = []) => {
  const source = readFileSync(new URL('../controllers/System/workflow.controller.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm, '\n')
    .replace(/^export const /gm, 'const ');
  const names = {
    db, DEPARTMENT_HEAD_ROLE, DEPARTMENT_STAFF_ROLES, getRoleDepartment,
    getOperationalReviewForUpdate, appendReviewEvent, canActorSeeReview,
    createInternalNotifications, notifyAuditors, REVIEW_ACTION_NOTIFICATION_STAGES, activeNotificationSql,
    writeAuditLog: async (_db, _req, entry) => { auditWrites.push(entry); },
  };
  const factory = new Function(...Object.keys(names), `${source}\nreturn { returnReviewForCorrection, confirmHeadReview, reviewQueueWhere };`);
  return factory(...Object.values(names));
};

const makeDB = () => {
  const head = { id: 22, role: 'accounting_head', all_projects_access: 1 };
  const staff = { id: 11, role: 'accounting_staff', all_projects_access: 1 };
  const auditor = { id: 33, role: 'auditor', all_projects_access: 1 };
  const state = {
    row: null, notifications: [], events: [], queries: [],
    activeAuditCase: null, nextId: 91,
  };
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql, params = []) {
      state.queries.push({ sql, params });
      if (/information_schema\.COLUMNS/.test(sql)) return [[{ 1: 1 }]];
      if (/SELECT \* FROM operational_reviews\s+WHERE entity_type/.test(sql)) return [[]];
      if (/SELECT \* FROM operational_reviews WHERE operational_review_id = \?/.test(sql)) return [state.row && Number(params[0]) === state.row.operational_review_id ? [{ ...state.row }] : []];
      if (/SELECT \* FROM operational_reviews\s+WHERE entity_type = \? AND entity_id = \? AND department = \?/.test(sql)) return [[]];
      if (/FROM audit_cases c\s+INNER JOIN operational_reviews r/.test(sql)) return [state.activeAuditCase ? [state.activeAuditCase] : []];
      if (/SELECT u\.id FROM users u WHERE u\.role = \?/.test(sql)) {
        const id = params[0] === 'accounting_head' ? 22 : params[0] === 'auditor' ? 33 : null;
        return [id ? [{ id }] : []];
      }
      if (/INSERT INTO operational_reviews/.test(sql)) {
        const id = state.nextId++;
        state.row = {
          operational_review_id: id, review_number: null, status: params[10],
          action_key: params[0], department: params[1], lot_project_id: params[2],
          entity_type: params[3], entity_id: params[4], entity_label: params[5],
          initiated_by_user_id: params[6], initiated_by_role: params[7],
          claimed_by_user_id: null, approval_type: params.at(-1),
        };
        return [{ insertId: id }];
      }
      if (/UPDATE operational_reviews SET review_number/.test(sql)) { state.row.review_number = params[0]; return [{ affectedRows: 1 }]; }
      if (/UPDATE operational_reviews/.test(sql) && state.row) {
        const status = sql.match(/\bstatus\s*=\s*'([^']+)'/);
        if (status) state.row.status = status[1];
        if (/head_reviewed_by_user_id=\?/.test(sql)) state.row.head_reviewed_by_user_id = params[1];
        return [{ affectedRows: 1 }];
      }
      if (/INSERT INTO operational_review_events/.test(sql)) {
        state.events.push({ reviewId: params[0], eventType: params[1], actorId: params[4], message: params[6], metadata: params[7] });
        return [{ insertId: state.events.length }];
      }
      if (/INSERT INTO internal_notifications/.test(sql)) {
        for (let i = 0; i < params.length; i += 7) {
          state.notifications.push({ recipient: params[i], type: params[i+1], reviewId: params[i+5] });
        }
        return [{ affectedRows: params.length / 7 }];
      }
      if (/SELECT n\.internal_notification_id/.test(sql)) return [[]];
      if (/SELECT id FROM users WHERE role='system_admin'/.test(sql)) return [[]];
      return [[]];
    },
  };
  return { ...state, connection, state, head, staff, auditor, db: { getConnection: async () => connection } };
};

const response = () => {
  const output = { code: 200, payload: null };
  const res = { status(code) { output.code = code; return this; }, json(data) { output.payload = data; return this; } };
  return { res, output };
};

// These checks validate the exact recipient and stage of each review handoff.
test('Staff saves payment -> Accounting Head only; Auditor is not queued yet', async () => {
  const env = makeDB();
  const review = await createOperationalReview(env.connection, {
    actor: env.staff, actionKey: 'payment.create', department: 'accounting',
    entityType: 'lot_project_payment', entityId: 101,
    beforeSnapshot: { amount: 0 }, afterSnapshot: { amount: 100 },
  });
  assert.equal(review.status, 'pending_head_review');
  assert.equal(env.state.row.status, 'pending_head_review');
  assert.ok(env.state.notifications.some((n) => n.recipient === 22 && n.type === 'department_review_required'));
  assert.ok(!env.state.notifications.some((n) => n.recipient === 33));
});

test('Head returns payment -> Staff correction queue, NOT Auditor; resubmit -> Head', async () => {
  const env = makeDB();
  await createOperationalReview(env.connection, {
    actor: env.staff, actionKey: 'payment.create', department: 'accounting',
    entityType: 'lot_project_payment', entityId: 101,
  });
  const handlers = loadHandlers(env.db);
  const returned = response();
  await handlers.returnReviewForCorrection({ params: { id: '91' }, authUser: env.head, body: { reason: 'Reference number does not match the deposit slip' } }, returned.res);
  assert.equal(returned.output.code, 200, JSON.stringify(returned.output.payload));
  assert.equal(env.state.row.status, 'returned_for_correction');
  assert.equal(env.state.notifications.at(-1).recipient, env.staff.id);
  assert.equal(env.state.notifications.at(-1).type, 'review_returned');
  assert.ok(!env.state.notifications.some((n) => n.recipient === env.auditor.id));
  assert.match(handlers.reviewQueueWhere(env.staff).sql, /status='returned_for_correction' AND .*initiated_by_user_id=\?/);
  assert.match(handlers.reviewQueueWhere(env.head).sql, /status='pending_head_review'/);
  assert.match(handlers.reviewQueueWhere(env.auditor).sql, /pending_auditor_review/);

  await resubmitReturnedOperationalReview(env.connection, {
    review: { ...env.state.row }, actor: env.staff, department: 'accounting',
    afterSnapshot: { amount: 100, reference: 'FIXED' },
  });
  assert.equal(env.state.row.status, 'pending_head_review');
  assert.equal(env.state.notifications.at(-1).recipient, env.head.id);
  assert.equal(env.state.notifications.at(-1).type, 'department_review_required');
});

test('Head confirms corrected record -> Auditor only, with an audit trail', async () => {
  const env = makeDB();
  await createOperationalReview(env.connection, {
    actor: env.staff, actionKey: 'payment.create', department: 'accounting',
    entityType: 'lot_project_payment', entityId: 101,
  });
  const auditWrites = [];
  const handlers = loadHandlers(env.db, auditWrites);
  const confirmed = response();
  await handlers.confirmHeadReview({ params: { id: '91' }, authUser: env.head, body: { note: 'Payment verified' } }, confirmed.res);
  assert.equal(confirmed.output.code, 200, JSON.stringify(confirmed.output.payload));
  assert.equal(env.state.row.status, 'pending_auditor_review');
  assert.equal(env.state.notifications.at(-1).recipient, env.auditor.id);
  assert.equal(env.state.notifications.at(-1).type, 'audit_review_required');
  assert.ok(env.state.events.some((e) => e.eventType === 'head_confirmed'));
  assert.ok(auditWrites.some((e) => e.action === 'approve'));
});

test('Open Audit Case never blocks editing and captures changed values in case history', async () => {
  const env = makeDB();
  env.state.activeAuditCase = { audit_case_id: 44, case_number: 'CASE-00044', operational_review_id: 70 };
  for (const status of ['returned_for_correction', 'audit_case_open', 'correction_required', 'pending_auditor_recheck']) {
    assert.equal(await assertEntityNotReviewLocked(env.connection, { entityType: 'lot_project_payment', entityId: 101, status }), true);
  }
  const review = await createOperationalReview(env.connection, {
    actor: env.staff, actionKey: 'payment.create', department: 'accounting',
    entityType: 'lot_project_payment', entityId: 101,
    beforeSnapshot: { amount: 100 }, afterSnapshot: { amount: 110 },
  });
  assert.equal(review.status, 'pending_head_review', 'new Staff edit still goes to Head, even while an Audit Case exists');
  assert.ok(env.state.events.some((event) => event.eventType === 'record_changed_during_audit_case'
    && event.reviewId === 70 && event.actorId === env.staff.id
    && JSON.parse(event.metadata).afterSnapshot.amount === 110));
});

