import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../../client/src/pages/System/ReviewCenter.jsx', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../controllers/System/workflow.controller.js', import.meta.url), 'utf8');
const router = readFileSync(new URL('../routers/System/workflow.routers.js', import.meta.url), 'utf8');
const detail = ui.split('export const ReviewDetails =')[1].split('const ReviewCenter =')[0];

test('No standalone Claim Review control remains, while Head confirmation and correction remain', () => {
  assert.doesNotMatch(detail, /Claim Review|type: 'claim'/);
  assert.match(detail, /type: 'head-confirm'/);
  assert.match(detail, /setAction\('return'\)/);
  assert.match(detail, /const correctAndConfirm = \(\) =>/);
  assert.doesNotMatch(detail, /\/reviews\/\$\{reviewId\}\/claim/);
});

test('Return for Correction renders for every actionable pending Head review, including listing imports', () => {
  assert.match(detail, /isHead && review.status === 'pending_head_review' \? <>/);
  assert.match(detail, /<button type="button" onClick=\{\(\) => setAction\('return'\)\}[^\n]*Return for Correction<\/button>/);
  assert.doesNotMatch(detail, /supportsRecordCorrection \? <button[^>]*setAction\('return'\)/);
  assert.match(detail, /'listing.import'/);
  assert.match(detail, /!supportsRecordCorrection/);
  assert.match(detail, /Submit Correction Details for Recheck/);
});

test('Manual follow-up resubmission has a server route, original-staff guard, audit trail, and notifications', () => {
  assert.match(router, /resubmit-manual.*resubmitManualReviewCorrection/);
  const action = controller.split('export const resubmitManualReviewCorrection =')[1].split('export const auditorVerifyReview =')[0];
  assert.match(action, /initiated_by_user_id/);
  assert.match(action, /getRoleDepartment\(req.authUser\)/);
  assert.match(action, /canActorSeeReview/);
  assert.match(action, /'returned_for_correction'/);
  assert.match(action, /'pending_head_review'/);
  assert.match(action, /appendReviewEvent/);
  assert.match(action, /notifyDepartmentHeads/);
  assert.match(action, /writeAuditLog/);
  assert.doesNotMatch(action, /before_snapshot_json\s*=|after_snapshot_json\s*=/);
});

test('Head confirmation and return do not require a separate claim; history retains the acting Head', () => {
  const confirmed = controller.split('export const confirmHeadReview =')[1].split('export const returnReviewForCorrection =')[0];
  const returned = controller.split('export const returnReviewForCorrection =')[1].split('const MANUAL_RESUBMIT_ACTION_KEYS')[0];
  for (const section of [confirmed, returned]) {
    assert.doesNotMatch(section, /Another Head already claimed/);
    assert.match(section, /head_reviewed_by_user_id=\?/);
    assert.match(section, /appendReviewEvent/);
  }
});
