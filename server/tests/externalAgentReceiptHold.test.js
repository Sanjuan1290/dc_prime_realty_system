import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const controller = read('server/controllers/Lot_Projects/Commissions/Commissions.controller.js');
const progressService = read('server/services/commissionProgress.service.js');
const modal = read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');
const page = read('client/src/pages/Lot_Projects/Commission.jsx');
const listingsController = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
const migration = read('server/migrations/20260819_external_group_agent_receipt_status.sql');

test('external release receipt tracking stores only submitted/unsubmitted status', () => {
  assert.match(migration, /external_agent_receipt_status ENUM\('unsubmitted','submitted'\)/);
  assert.match(migration, /external_receipt_hold_source_release_id/);
  assert.doesNotMatch(migration, /CREATE TABLE[\s\S]*receipt_file/i);
  assert.match(controller, /set_agent_receipt_status/);
  assert.match(controller, /external_agent_receipt_status = 'unsubmitted'/);
  assert.match(modal, /Mark Submitted/);
  assert.match(modal, /Mark Unsubmitted/);
  assert.match(modal, /Agent Receipt/);
});

test('unsubmitted external receipt holds only the next eligible unreleased milestone', () => {
  assert.match(controller, /previousReceiptBlocks/);
  assert.match(controller, /baseStatus === 'Eligible'/);
  assert.match(controller, /previous[\s\S]*release_status[\s\S]*Released/);
  assert.match(controller, /external_receipt_hold_source_release_id/);
  assert.match(controller, /Preserve a manual\/default hold/);
  assert.match(controller, /cannot be unheld until the .* External Realty agent receipt is marked Submitted/);
  assert.match(controller, /is on hold until the .* External Realty agent receipt is marked Submitted/);
});

test('payment progress synchronization applies the receipt hold without opening the commission page', () => {
  assert.match(progressService, /commission_role/);
  assert.match(progressService, /external_agent_receipt_status/);
  assert.match(progressService, /external_receipt_hold_source_release_id/);
  assert.match(progressService, /previousReceiptBlocks/);
  assert.match(progressService, /nextStatus = 'On Hold'/);
});

test('receipt status changes use compact confirmation and do not enter release double-check flow', () => {
  assert.match(page, /\['hold_stage', 'unhold_stage', 'set_agent_receipt_status'\]\.includes\(action\)/);
  assert.match(modal, /Mark Agent Receipt Submitted\?/);
  assert.match(modal, /Mark Agent Receipt Unsubmitted\?/);
});

test('cancelled-sale archive preserves the external receipt status', () => {
  assert.match(migration, /ALTER TABLE lot_project_archived_commission_releases[\s\S]*external_agent_receipt_status/);
  assert.match(listingsController, /historical_release_note,[\s\S]*external_agent_receipt_status,[\s\S]*receipt_date/);
  assert.match(listingsController, /r\.historical_release_note,[\s\S]*r\.external_agent_receipt_status,[\s\S]*receipt\.receipt_date/);
});
