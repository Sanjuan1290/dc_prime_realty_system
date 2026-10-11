import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Network rate correction resolves the original Staff returned Review instead of creating a duplicate', () => {
  const controller = read('server/controllers/System/sellerGroup.controller.js');

  assert.match(controller, /const getReturnedNetworkRateReviewForActor = async/);
  assert.match(controller, /candidate\.status !== 'returned_for_correction'/);
  assert.match(controller, /candidate\.action_key !== 'network\.rates\.update'/);
  assert.match(controller, /candidate\.entity_type !== 'seller_group_project_rates'/);
  assert.match(controller, /Number\(candidate\.initiated_by_user_id \|\| 0\) !== Number\(actor\.id \|\| 0\)/);

  assert.match(controller, /let rateReturnedReview = null/);
  assert.match(controller, /rateReturnedReview = await getReturnedNetworkRateReviewForActor/);
  assert.match(controller, /allowReviewId: rateAuditCase\?\.operational_review_id \|\| rateReturnedReview\?\.operational_review_id \|\| null/);
  assert.match(controller, /rateReview = await resubmitReturnedOperationalReview\(connection, \{[\s\S]*review: rateReturnedReview/);
});

test('single-project Network rate correction is scoped to the exact returned project', () => {
  const controller = read('server/controllers/System/sellerGroup.controller.js');

  assert.ok(controller.includes("const returnedRateProjectId = Number(returnedRateEntityId.split(':')[1] || 0);"));
  assert.match(controller, /This returned Review applies to one project rate only/);
  assert.match(controller, /RETURNED_REVIEW_SCOPE_MISMATCH/);
  assert.match(controller, /buildSingleProjectRateReviewSnapshot/);
  assert.match(controller, /entityId: `\$\{normalizedGroupId\}:\$\{normalizedProjectId\}`/);
});

test('per-project rate endpoint can resubmit a returned review using the same review id', () => {
  const controller = read('server/controllers/System/sellerGroup.controller.js');
  const perProjectStart = controller.indexOf('export const updateGroupProjectPool');
  assert.ok(perProjectStart >= 0);
  const perProject = controller.slice(perProjectStart);

  assert.match(perProject, /returnedReview = await getReturnedNetworkRateReviewForActor/);
  assert.match(perProject, /allowReviewId: auditCase\?\.operational_review_id \|\| returnedReview\?\.operational_review_id \|\| null/);
  assert.match(perProject, /returnedReview[\s\S]*resubmitReturnedOperationalReview\(connection/);
  assert.match(perProject, /review: returnedReview/);
});

