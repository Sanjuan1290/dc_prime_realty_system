import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('commission releases serialize through the parent commission and are idempotent', () => {
  const source = read('server/controllers/Lot_Projects/Commissions/Commissions.controller.js');
  assert.match(source, /SELECT lot_project_commission_id[\s\S]*FROM lot_project_commissions[\s\S]*FOR UPDATE/);
  assert.match(source, /computedStatus === 'Released'[\s\S]*alreadyApplied: true/);
  assert.match(source, /UPDATE lot_project_commission_releases[\s\S]*AND release_status = \?/);
  assert.match(source, /SELECT \*[\s\S]*FROM lot_project_commissions[\s\S]*LIMIT 1[\s\S]*FOR UPDATE/);
});

test('cancellation settlement locks the account payment set and settlement history', () => {
  const listing = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
  const accountService = read('server/services/lotProjectAccount.service.js');

  assert.match(listing, /SELECT lot_project_payment_id[\s\S]*lot_project_payment_status = 'Verified'[\s\S]*FOR UPDATE/);
  assert.match(listing, /paymentScopeSql/);
  assert.match(listing, /SELECT lot_project_reservation_history_id, reservation_status[\s\S]*FOR UPDATE/);
  assert.match(listing, /account_status IN \('active', 'pending_cancellation'\)/);
  assert.match(accountService, /ORDER BY lot_project_commission_id[\s\S]*FOR UPDATE/);
  assert.match(accountService, /ORDER BY lot_project_commission_release_id[\s\S]*FOR UPDATE/);
  assert.match(accountService, /AND release_status = \?/);
});

test('penalty relief mutations serialize through the SOA row and locked relief history', () => {
  const source = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');

  assert.match(source, /getPenaltyReliefContext[\s\S]*forUpdate = false/);
  assert.match(source, /SELECT lot_project_listing_id[\s\S]*FOR UPDATE/);
  assert.match(source, /lockPaymentAccountForListing/);
  assert.match(source, /lockPaymentSchedulesForListing/);
  assert.match(source, /lot_project_payment_schedules[\s\S]*FOR UPDATE/);
  assert.match(source, /FROM lot_project_penalty_reliefs[\s\S]*ORDER BY penalty_relief_id[\s\S]*FOR UPDATE/);
  assert.match(source, /restorePaymentSchedulePenaltyWaiver[\s\S]*await connection\.beginTransaction\(\)[\s\S]*\{ forUpdate: true \}/);
  assert.match(source, /restores_penalty_relief_id = \?[\s\S]*relief_type = 'restoration'/);
  assert.match(source, /UPDATE lot_project_penalty_reliefs[\s\S]*status = 'restored'[\s\S]*status <> 'cancelled'/);
});

test('Batch 4 migration adds financial uniqueness guards without resetting data', () => {
  const migration = read('server/migrations/20260803_financial_transaction_hardening.sql');
  assert.match(migration, /uq_commission_release_stage/);
  assert.doesNotMatch(migration, /DROP DATABASE/i);
  assert.doesNotMatch(migration, /TRUNCATE TABLE/i);
});

