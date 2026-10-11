import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activeNotificationSql, settleReviewNotifications } from '../services/internalNotification.service.js';
import { countWorkflowSummaryNotifications } from '../services/workflowSummaryNotifications.service.js';

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// This is the specific unsupported syntax diagnosed from the production TiDB response.
// A correlated subquery is valid in a WHERE expression, but not after JOIN ... ON.
const unsupportedJoin = /\bJOIN\s+audit_cases\s+ac\s+ON\s+ac\.audit_case_id\s*=\s*\(\s*SELECT/i;

test('Review Center SQL uses a derived latest-Audit-Case join instead of ON (SELECT ...)', () => {
  const sql = activeNotificationSql('n');
  assert.doesNotMatch(sql, unsupportedJoin);
  assert.match(sql, /LEFT JOIN \(\s*SELECT operational_review_id, MAX\(audit_case_id\) AS latest_audit_case_id\s+FROM audit_cases\s+GROUP BY operational_review_id\s*\) latest_case/i);
  assert.match(sql, /latest_case\.operational_review_id = r\.operational_review_id/);
  assert.match(sql, /LEFT JOIN audit_cases ac ON ac\.audit_case_id = latest_case\.latest_audit_case_id/);
  assert.match(sql, /audit_case_response_required/);
  assert.match(sql, /newer_info\.internal_notification_id/);
});

test('Notification cleanup emits TiDB-safe SQL while preserving record and action visibility', async () => {
  const calls = [];
  const connection = { query: async (sql, params) => {
    assert.doesNotMatch(sql, unsupportedJoin);
    calls.push({sql, params});
    return [[]];
  } };
  await settleReviewNotifications(connection, 60001);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /SELECT n\.internal_notification_id/);
  assert.match(calls[0].sql, /latest_case\.latest_audit_case_id/);
  assert.deepEqual(calls[0].params, [60001]);
});

test('Summary notification query executes the same TiDB-compatible filter', async () => {
  const queries = [];
  const visibility = {
    join: 'LEFT JOIN operational_reviews nr ON nr.operational_review_id=n.operational_review_id',
    sql: `(${activeNotificationSql('n')})`, params: [],
  };
  const output = await countWorkflowSummaryNotifications({
    connection: { query: async (sql, params) => {
      assert.doesNotMatch(sql, unsupportedJoin);
      queries.push({ sql, params });
      return [[{ unread: queries.length === 1 ? 4 : 2 }]];
    } },
    actorId: 60001,
    visibility,
    actionTypes: ['audit_review_required'],
  });
  assert.equal(queries.length, 2);
  assert.deepEqual(output, {
    unreadNotifications: 4,
    unreadActionNotifications: 2,
    notificationCountsAvailable: true,
  });
});

test('Notification listing and summary both consume the TiDB-safe active filter', () => {
  const controller = source('controllers/System/workflow.controller.js');
  assert.match(controller, /const notificationVisibilityWhere/);
  assert.match(controller, /activeNotificationSql\('n'\)/);
  assert.match(controller, /const access = notificationVisibilityWhere\(req\.authUser\)/);
  assert.match(controller, /visibility: notificationVisibilityWhere\(actor\)/);
});

test('Legacy inventory fallback no longer places correlated lookup inside JOIN ON', () => {
  const controller = source('controllers/Lot_Projects/Listings/Listings.controller.js');
  assert.doesNotMatch(controller, /ON cp\.lot_project_client_profile_id = \(\s*SELECT/);
  assert.match(controller, /MAX\(lot_project_client_profile_id\) AS latest_active_profile_id/);
  assert.match(controller, /cp\.lot_project_client_profile_id = cp_current\.latest_active_profile_id/);
});
