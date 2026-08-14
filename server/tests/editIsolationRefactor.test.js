import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('reservation SOA rows are created with the buyer account id', () => {
  const source = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');
  assert.match(source, /replaceReservationSchedules = async \(connection, projectId, listing, clientProfileId, accountId/);
  assert.match(source, /'lot_project_account_id'/);
  assert.match(source, /replaceReservationSchedules\(connection, project\.lot_project_id, listing, clientProfileId, account\.accountId/);
});

test('listing-triggered SOA regeneration preserves account history and never deletes by listing alone', () => {
  const source = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
  const start = source.indexOf('const replaceListingSchedulesForProfile');
  const end = source.indexOf('export const normalizeCancellationRefundType', start);
  const helper = source.slice(start, end);
  assert.match(helper, /lot_project_account_id/);
  assert.match(helper, /SET schedule_status = 'Cancelled'/);
  assert.match(helper, /AND lot_project_client_profile_id = \?/);
  assert.match(helper, /AND lot_project_account_id = \?/);
  assert.doesNotMatch(helper, /DELETE FROM lot_project_payment_schedules WHERE lot_project_listing_id = \?/);
});

test('ordinary listing edits trigger dependent systems only on real changes', () => {
  const source = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
  assert.match(source, /const annualInterestChanged = hasAnnualInterestRate/);
  assert.match(source, /const soaSyncResult = annualInterestChanged/);
  assert.match(source, /buyerFormSchemaAvailable && \(unitIdChanged \|\| statusChanged\)/);
  assert.match(source, /cadastralSyncResult/);
  assert.doesNotMatch(source, /DELETE FROM lot_project_listing_cadastral_lots WHERE lot_project_listing_id = \?`/);
});


test('ordinary listing edits preserve an existing fully-paid sold substatus', () => {
  const source = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
  assert.match(source, /explicitlyRequestedSoldSubstatus/);
  assert.match(source, /soldSubstatus: existingListing\.lot_project_listing_sold_substatus \|\| 'active'/);
});

test('unit-id edits recommend previous id and require explicit skip confirmation', () => {
  const api = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/EditUnitStatusModal.jsx');
  assert.match(api, /PREVIOUS_UNIT_ID_CONFIRMATION_REQUIRED/);
  assert.match(api, /confirmSkipPreviousUnitId/);
  assert.match(modal, /appendOldUnitId/);
  assert.match(modal, /No Old Unit ID Recorded/);
  assert.match(modal, /Continue Without Old Unit ID/);
  assert.match(modal, /Add \{originalUnitCode\} &amp; Continue/);
  assert.doesNotMatch(modal, /Existing Cloudinary document assets will be moved/);
});

test('project edits protect location codes and assigned cadastral master rows', () => {
  const source = read('server/controllers/System/projects.controller.js');
  const modal = read('client/src/components/System/projectComponents/AddLotProjectModal.jsx');
  assert.match(source, /PROJECT_LOCATION_CODE_LOCKED/);
  assert.match(source, /const stableSlug = slugWasSubmitted \? payload\.slug : existingProject\.lot_project_slug/);
  assert.match(source, /CADASTRAL_LOT_IN_USE/);
  assert.match(source, /used_by_units/);
  assert.doesNotMatch(source, /DELETE FROM lot_project_cadastral_lot_numbers WHERE lot_project_id = \?`/);
  assert.match(modal, /locationCodeLocked/);
  assert.match(modal, /cannot be edited or deleted/);
});

test('database migration backfills account ids and changes cadastral delete to RESTRICT', () => {
  const migration = read('server/migrations/20260814_edit_isolation_and_account_integrity.sql');
  assert.match(migration, /UPDATE lot_project_payment_schedules schedule[\s\S]*SET schedule\.lot_project_account_id = account\.lot_project_account_id/);
  assert.match(migration, /DROP FOREIGN KEY fk_listing_cadastral_lot_number/);
  assert.match(migration, /ON DELETE RESTRICT/);
});

test('schedule repair script is buyer-account scoped', () => {
  const source = read('server/scripts/repair-schedule-balances.js');
  assert.match(source, /FROM lot_project_accounts account/);
  assert.match(source, /lot_project_account_id = \?/);
  assert.match(source, /listing\.lot_project_account_id/);
  assert.match(source, /listing\.current_account_id/);
  assert.match(source, /AND lot_project_account_id = \?/);
  assert.match(source, /current_account_id = \?/);
});

test('employee profile edits only rewrite work schedules when schedule values changed', () => {
  const source = read('server/controllers/System/Employees/Employees.controller.js');
  assert.match(source, /buildRequestedScheduleSignature/);
  assert.match(source, /buildExistingScheduleSignature/);
  assert.match(source, /if \(scheduleChanged\) \{[\s\S]*upsertEmployeeSchedules/);
});


test('project list aggregates and client mappings preserve cadastral usage without multiplying document counts', () => {
  const controller = read('server/controllers/System/projects.controller.js');
  const systemProjects = read('client/src/pages/System/Projects.jsx');
  const dashboard = read('client/src/pages/Lot_Projects/Dashboard.jsx');
  assert.match(controller, /COUNT\(DISTINCT CASE WHEN lpdd\.lot_project_default_document_is_required = 1 THEN lpdd\.lot_project_default_document_id END\) AS required_documents_count/);
  assert.match(systemProjects, /cadastralLotDetails/);
  assert.match(systemProjects, /listingCount/);
  assert.match(dashboard, /project\.cadastralLotDetails/);
  assert.match(dashboard, /listingCount/);
});
