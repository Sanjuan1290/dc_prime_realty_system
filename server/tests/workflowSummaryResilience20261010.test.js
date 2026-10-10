import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countWorkflowSummaryNotifications } from '../services/workflowSummaryNotifications.service.js';

const source = readFileSync(new URL('../controllers/System/workflow.controller.js', import.meta.url), 'utf8');
const reviewCenter = readFileSync(new URL('../../client/src/pages/System/ReviewCenter.jsx', import.meta.url), 'utf8');
const visibility = { join: 'LEFT JOIN operational_reviews nr ON nr.operational_review_id=n.operational_review_id', sql: 'nr.department=?', params: ['operations'] };

test('normal notification queries preserve scope, ordering and counts', async () => {
  const queries = [];
  const connection = { query: async (sql, params) => {
    queries.push({ sql, params });
    return [[{ unread: queries.length === 1 ? 6 : 2 }]];
  } };
  const result = await countWorkflowSummaryNotifications({ connection, actorId: 60007, visibility, actionTypes: ['department_review_required', 'review_returned'] });
  assert.deepEqual(result, { unreadNotifications: 6, unreadActionNotifications: 2, notificationCountsAvailable: true });
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[0].params, [60007, 'operations']);
  assert.deepEqual(queries[1].params, [60007, 'department_review_required', 'review_returned', 'operations']);
  assert.match(queries[0].sql, /FROM internal_notifications n LEFT JOIN operational_reviews nr/);
  assert.match(queries[1].sql, /notification_type IN \(\?,\?\)/);
});

test('first unread-notification SQL failure is isolated and reported as unavailable', async () => {
  const issue = new Error('Unknown column test');
  let observed;
  const result = await countWorkflowSummaryNotifications({
    connection: { query: async () => { throw issue; } },
    actorId: 7, visibility, actionTypes: ['review_returned'],
    onError: (error) => { observed = error; },
  });
  assert.equal(observed, issue);
  assert.deepEqual(result, { unreadNotifications: 0, unreadActionNotifications: 0, notificationCountsAvailable: false });
});

test('second notification SQL failure is isolated instead of returning a partial count', async () => {
  let count = 0;
  const result = await countWorkflowSummaryNotifications({
    connection: { query: async () => { count += 1; if (count === 2) throw new Error('database'); return [[{ unread: 3 }]]; } },
    actorId: 7, visibility, actionTypes: ['review_returned'],
  });
  assert.equal(count, 2);
  assert.equal(result.notificationCountsAvailable, false);
  assert.equal(result.unreadNotifications, 0);
});

test('empty notification-action types do not emit invalid IN () SQL', async () => {
  let count = 0;
  const result = await countWorkflowSummaryNotifications({
    connection: { query: async () => { count += 1; return [[{ unread: 8 }]]; } },
    actorId: 7, visibility, actionTypes: [],
  });
  assert.equal(count, 1);
  assert.deepEqual(result, { unreadNotifications: 8, unreadActionNotifications: 0, notificationCountsAvailable: true });
});

test('review queue remains authoritative and SQL errors are not sent to the browser', () => {
  assert.match(source, /const \[rows\] = await db.query\(\s*`SELECT status,COUNT\(\*\) total FROM operational_reviews r/);
  assert.match(source, /countWorkflowSummaryNotifications\(/);
  assert.match(source, /notificationCountsAvailable\s*\?\s*Math.max\(0, unreadNotifications - unreadActionNotifications\)\s*:\s*0/);
  assert.match(source, /logWorkflowSummaryError\('review_queue_count', error, req.authUser\)/);
  assert.match(source, /Unable to load the Review Center summary\. Please try again\./);
  assert.match(reviewCenter, /counts\.notificationCountsAvailable === false \? '—'/);
  assert.match(reviewCenter, /counts\.protectedCountsAvailable === false \? '—'/);
});
