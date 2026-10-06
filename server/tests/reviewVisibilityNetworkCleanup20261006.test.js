import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REVIEW_ACTIONS } from '../config/reviewActions.js';
import { activeNotificationSql, REVIEW_ACTION_NOTIFICATION_STAGES, settleReviewNotifications } from '../services/internalNotification.service.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Head audit-case access check uses the actor id (no undefined variable)', () => {
  const controller = read('server/controllers/System/workflow.controller.js');
  assert.doesNotMatch(controller, /includes\(Number\(actorId\)\)/);
  assert.match(controller, /responders\.userIds\.includes\(Number\(actor\.id \|\| 0\)\)/);
});

test('Review list supports a History & Tracking scope and flags work waiting on the viewer', () => {
  const controller = read('server/controllers/System/workflow.controller.js');
  assert.match(controller, /req\.query\.scope/);
  assert.match(controller, /reviewHistoryWhere/);
  assert.match(controller, /needs_my_action/);
  const center = read('client/src/pages/System/ReviewCenter.jsx');
  assert.match(center, /Needs My Action/);
  assert.match(center, /History &amp; Tracking/);
  assert.match(center, /&scope=\$\{reviewScope\}/);
});

test('Review details do not retry 4xx answers and reload after a failed action', () => {
  const center = read('client/src/pages/System/ReviewCenter.jsx');
  assert.match(center, /retry: \(count, error\)/);
  assert.match(center, /onError: async \(error\) => \{[\s\S]*query\.refetch\(\)/);
  assert.match(center, /title="View only"/);
});

test('every stage-specific action notification type maps to a review stage', () => {
  for (const type of [
    'department_review_required', 'review_returned', 'audit_review_required', 'audit_case_response_required',
    'audit_case_head_response', 'system_correction_required', 'audit_correction_rework', 'audit_correction_recheck',
  ]) assert.ok(REVIEW_ACTION_NOTIFICATION_STAGES[type], type);
  const sql = activeNotificationSql('n');
  assert.match(sql, /n\.operational_review_id IS NULL/);
  assert.match(sql, /assigned_responder_user_id = n\.user_id/);
  assert.doesNotMatch(sql, /CROSS JOIN/);
});

test('settling notifications selects first, then updates by id (MySQL safe)', async () => {
  const calls = [];
  const connection = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/^\s*SELECT n\.internal_notification_id/.test(sql)) return [[{ internal_notification_id: 7 }, { internal_notification_id: 9 }]];
      return [{ affectedRows: 2 }];
    },
  };
  await settleReviewNotifications(connection, 30002);
  assert.equal(calls.length, 2);
  assert.match(calls[1].sql, /^\s*UPDATE internal_notifications SET read_at/);
  assert.deepEqual(calls[1].params, [7, 9]);
});

test('notification list and unread count both hide moved-on action notifications', () => {
  const controller = read('server/controllers/System/workflow.controller.js');
  assert.match(controller, /SELECT COUNT\(\*\) unread FROM internal_notifications n \$\{notificationAccess\.join\} WHERE n\.user_id=\? AND n\.read_at IS NULL AND \$\{notificationAccess\.sql\}/);
  assert.match(controller, /SELECT n\.\* FROM internal_notifications n \$\{access\.join\} WHERE n\.user_id=\? AND \$\{access\.sql\}/);
  // Stale-stage filtering still applies inside the account visibility rule.
  assert.match(controller, /sql: `\(\$\{activeNotificationSql\('n'\)\}/);
});

test('duplicate broker name requires confirmation on create and on a changed edit', () => {
  const controller = read('server/controllers/System/sellerGroup.controller.js');
  assert.match(controller, /code: 'DUPLICATE_BROKER_NAME'/);
  assert.match(controller, /confirm_duplicate_broker/);
  assert.match(controller, /previousNormalized && previousNormalized === broker\.broker_name_normalized/);
  const router = read('server/routers/System/sellerGroup.routers.js');
  assert.ok(router.indexOf("'/broker-check'") < router.indexOf("'/:id'"), 'broker-check must be registered before /:id');
  const modal = read('client/src/components/System/sellerGroupComponents/NewGroupModal.jsx');
  assert.match(modal, /<BrokerNameWarning/);
  assert.match(modal, /brokerMatches\.length && !form\.confirm_duplicate_broker/);
});

test('empty Networks can be deleted; Networks with members or sales cannot', () => {
  assert.equal(REVIEW_ACTIONS['network.delete']?.department, 'marketing');
  const controller = read('server/controllers/System/sellerGroup.controller.js');
  assert.match(controller, /export const deleteGroup/);
  assert.match(controller, /code: 'NETWORK_NOT_DELETABLE'/);
  assert.match(controller, /assigned_accredited_seller_id = member\.accredited_seller_id/);
  assert.match(controller, /actionKey: 'network\.delete'/);
  const router = read('server/routers/System/sellerGroup.routers.js');
  assert.match(router, /router\.delete\('\/:id', requirePermission\(PERMISSIONS\.SYSTEM_SELLER_GROUPS_MANAGE\), deleteGroup\)/);
  const page = read('client/src/pages/System/SellerGroup.jsx');
  assert.match(page, /group\.deletion\?\.canDelete/);
});

test('review snapshots never store internal normalized broker keys', () => {
  const controller = read('server/controllers/System/sellerGroup.controller.js');
  const snapshot = controller.slice(controller.indexOf('const buildNetworkSnapshot'), controller.indexOf('const normalizeNetworkIdentity'));
  assert.doesNotMatch(snapshot, /broker: broker \|\|/);
  assert.doesNotMatch(snapshot, /broker_[a-z_]+_normalized/);
});



test('repeated status updates for the same review show only the newest one', () => {
  const sql = activeNotificationSql('n');
  assert.match(sql, /post_action_review_status/);
  assert.match(sql, /newer_info\.internal_notification_id > n\.internal_notification_id/);
});

test('History & Tracking keeps Head-stage work out of the Auditor view', () => {
  const controller = read('server/controllers/System/workflow.controller.js');
  assert.match(controller, /head_reviewed_at IS NOT NULL AND \$\{alias\}\.status NOT IN \('pending_head_review','returned_for_correction'\)/);
});

test('Listings page has no imports from recharts internal type paths', () => {
  const listings = read('client/src/pages/Lot_Projects/Listings.jsx');
  assert.doesNotMatch(listings, /from 'recharts\/types\//);
});
