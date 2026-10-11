import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const listingsPath = new URL('../controllers/Lot_Projects/Listings/Listings.controller.js', import.meta.url);
const clientProfilePath = new URL('../controllers/Lot_Projects/ListingProfile/ClientProfile.controller.js', import.meta.url);

const listings = await readFile(listingsPath, 'utf8');
const clientProfile = await readFile(clientProfilePath, 'utf8');

test('listing inventory resolves buyer through current_account_id instead of all active profiles', () => {
  assert.match(listings, /LEFT JOIN lot_project_accounts current_account[\s\S]*l\.current_account_id/);
  assert.match(listings, /cp\.lot_project_client_profile_id = current_account\.lot_project_client_profile_id/);
  assert.doesNotMatch(
    listings.slice(listings.indexOf('export const getLotProjectListings'), listings.indexOf('const replaceListingSchedulesForProfile')),
    /cp\.lot_project_listing_id = l\.lot_project_listing_id AND cp\.lot_project_client_profile_status = 'active'/
  );
});

test('editing a buyer profile updates the current account profile and never inserts a new one', () => {
  assert.match(clientProfile, /current_account_id/);
  assert.match(clientProfile, /FROM lot_project_accounts[\s\S]*FOR UPDATE/);
  assert.match(clientProfile, /UPDATE lot_project_client_profiles/);

  const updateFunction = clientProfile.slice(clientProfile.indexOf('export const updateLotProjectClientProfile'));
  assert.doesNotMatch(updateFunction, /INSERT INTO lot_project_client_profiles/);
  assert.doesNotMatch(updateFunction, /ON DUPLICATE KEY UPDATE/);
});

