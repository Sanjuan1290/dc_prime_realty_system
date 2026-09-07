import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('historical reservation creation seeds the canonical penalty cache immediately', () => {
  const source = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');

  assert.match(source, /refreshListingPenaltyCache/);
  assert.match(source, /recomputeListingScheduleBalances/);
  assert.match(source, /await refreshListingPenaltyCache\(connection, reservedListing, today\)/);
  assert.match(source, /await recomputeListingScheduleBalances\(connection, reservedListing, \{ asOfDate: today \}\)/);
});

test('dashboard and notifications repair stale caches before reading stored penalties', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  const dashboard = read('server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js');
  const notifications = read('server/controllers/System/notifications.controller.js');

  assert.match(shared, /export const refreshStaleDailyPenaltyCaches/);
  assert.match(shared, /penalty_calculated_through IS NULL OR s\.penalty_calculated_through < \?/);
  assert.match(shared, /l\.current_account_id/);
  assert.match(shared, /getLatestActiveScheduleGenerationPredicate\('s'\)/);
  assert.match(dashboard, /await refreshStaleDailyPenaltyCaches\(connection, \{[\s\S]*lotProjectId: project\.lot_project_id/);
  assert.ok((notifications.match(/refreshStaleDailyPenaltyCaches\(/g) || []).length >= 2);
});

test('data integrity reports stale penalty caches without writing repairs', () => {
  const controller = read('server/controllers/System/dataIntegrity.controller.js');

  assert.match(controller, /Daily penalty cache is stale/);
  assert.match(controller, /penalty_calculated_through/);
  assert.doesNotMatch(controller, /connection\.query\(\s*`\s*(?:UPDATE|INSERT|DELETE|ALTER|TRUNCATE)/i);
  assert.doesNotMatch(controller, /connection\.execute\(\s*`\s*(?:UPDATE|INSERT|DELETE|ALTER|TRUNCATE)/i);
});
