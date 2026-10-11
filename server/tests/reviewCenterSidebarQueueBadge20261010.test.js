import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const hook = read('client/src/utils/useWorkflowBadge.js');
const layout = read('client/src/layout/SystemLayout.jsx');
const controller = read('server/controllers/System/workflow.controller.js');
const center = read('client/src/pages/System/ReviewCenter.jsx');
const details = read('client/src/pages/System/ReviewDetailsPage.jsx');

test('sidebar uses the count of Needs My Action reviews, not notification totals', () => {
  assert.match(hook, /\/workflow\/reviews\?scope=queue&limit=1&page=1/);
  assert.match(hook, /query\.data\?\.pagination\?\.total/);
  assert.doesNotMatch(hook, /\/workflow\/summary|unreadNotifications|pendingProtectedChanges/);
  assert.match(controller, /const history = scope === 'history' \? reviewHistoryWhere\(req\.authUser\) : null/);
  assert.match(controller, /sql: `\(\$\{history\.sql\}\) AND NOT \(\$\{queue\.sql\}\)`/);
  assert.match(controller, /pagination: \{ page, limit, total:/);
  assert.match(center, /scope=\$\{reviewScope\}/);
});

test('badge is account scoped, permission gated, and refreshed on changes and focus', () => {
  assert.match(hook, /user\?\.id \|\| 0, user\?\.role \|\| ''/);
  assert.match(hook, /hasPermission\(user, PERMISSIONS\.WORKFLOW_REVIEW_CENTER_VIEW\)/);
  assert.match(hook, /queryKey: \['workflow-reviews', 'sidebar-count'/);
  assert.match(hook, /refetchInterval: 30_000/);
  assert.match(hook, /refetchOnWindowFocus: true/);
  assert.match(details, /invalidateQueries\(\{ queryKey: \['workflow-reviews'\] \}\)/);
});

test('sidebar shows the review count beside Review Center with a meaningful label', () => {
  assert.match(layout, /label: "Review Center"[^\n]*badge: workflowBadgeCount, badgeLabel: 'reviews awaiting your action'/);
  assert.match(layout, /title=\{`\$\{item\.badge\} \$\{item\.badgeLabel/);
  assert.match(layout, /item\.pathname === 'review-center' \? 'bg-blue-600' : 'bg-red-500'/);
  assert.match(layout, /Number\(item\.badge\) > 99 \? '99\+' : item\.badge/);
  assert.match(layout, /Number\(item\.badge \|\| 0\) > 0/);
  assert.match(layout, /label: "Notifications"[^\n]*badge: notificationCount/);
});

test('the backend applies per-role review scopes, including the heads department and project restrictions', () => {
  assert.match(controller, /DEPARTMENT_STAFF_ROLES\.includes\(role\)/);
  assert.match(controller, /DEPARTMENT_HEAD_ROLE\[department\] === role/);
  assert.match(controller, /\$\{alias\}\.department = \?/);
  assert.match(controller, /user_project_access wupa/);
  assert.match(controller, /pending_head_review/);
  assert.match(controller, /pending_auditor_review/);
  assert.match(controller, /returned_for_correction/);
});


