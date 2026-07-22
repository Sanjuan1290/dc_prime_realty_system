import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('commission milestones cannot be manually cancelled from the release details modal', () => {
  const modal = read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');

  assert.match(modal, /Main Release Milestones/);
  assert.match(modal, /hold_stage/);
  assert.match(modal, /unhold_stage/);
  assert.doesNotMatch(modal, /cancel_stage/);
  assert.doesNotMatch(modal, />\s*Cancel\s*<\/button>/);
});

test('commission update endpoint rejects manual milestone and legacy commission cancellation actions', () => {
  const controller = read('server/controllers/Lot_Projects/Commissions/Commissions.controller.js');

  assert.match(controller, /\['release_stage', 'hold_stage', 'unhold_stage'\]\.includes\(action\)/);
  assert.doesNotMatch(controller, /action === 'cancel_stage'/);
  assert.doesNotMatch(controller, /action === 'cancel'/);
  assert.doesNotMatch(controller, /canCancel:/);
});

test('automatic cancellation settlement statuses remain supported as historical business states', () => {
  const controller = read('server/controllers/Lot_Projects/Commissions/Commissions.controller.js');
  const modal = read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');

  assert.match(controller, /Earned on Cancellation/);
  assert.match(controller, /Forfeited on Cancellation/);
  assert.match(modal, /Earned on Cancellation/);
  assert.match(modal, /Forfeited on Cancellation/);
});
