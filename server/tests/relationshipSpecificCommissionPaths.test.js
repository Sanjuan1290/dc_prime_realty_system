import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('fixed Realty rates are stored once per project and legacy individual rates are disabled', async () => {
  const migration = await readSource('../migrations/20260720_group_fixed_project_commission_rates.sql');

  assert.match(migration, /bnm_override_rate/);
  assert.match(migration, /broker_override_rate/);
  assert.match(migration, /manager_override_rate/);
  assert.match(migration, /agent_rate/);
  assert.match(migration, /chk_group_fixed_role_rates_total/);
  assert.match(migration, /UPDATE accredited_seller_lot_project_rates[\s\S]*'inactive'/);
  assert.match(migration, /UPDATE agent_lot_project_direct_rates[\s\S]*'inactive'/);
  assert.match(migration, /UPDATE seller_hierarchy_lot_project_overrides[\s\S]*'inactive'/);
  assert.doesNotMatch(migration, /UPDATE lot_project_commissions/);
});

test('seller group controller updates only the fixed Realty + Project rate structure', async () => {
  const [controller, router] = await Promise.all([
    readSource('../controllers/System/sellerGroup.controller.js'),
    readSource('../routers/System/sellerGroup.routers.js'),
  ]);

  assert.match(controller, /validateGroupFixedRateStructure/);
  assert.match(controller, /seller_group_pool_rate = \?/);
  assert.match(controller, /bnm_override_rate = \?/);
  assert.match(controller, /broker_override_rate = \?/);
  assert.match(controller, /manager_override_rate = \?/);
  assert.match(controller, /agent_rate = \?/);
  assert.match(router, /projects\/:projectId\/pool/);
  assert.doesNotMatch(router, /direct-rate/);
  assert.doesNotMatch(router, /agents\/:agentId\/path/);
  assert.doesNotMatch(controller, /upsertHierarchyOverride/);
});

test('seller group UI shows one fixed project structure and does not render commission paths', async () => {
  const [page, projectFields] = await Promise.all([
    readSource('../../client/src/pages/System/SellerGroupDetails.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/ProjectAccreditationFields.jsx'),
  ]);

  assert.match(page, /Fixed Project Commission Structure/);
  assert.match(page, /Rates are not repeated per seller/);
  assert.doesNotMatch(page, /Commission Paths/);
  assert.doesNotMatch(page, /Edit Path/);
  assert.match(projectFields, /BNM Override/);
  assert.match(projectFields, /Broker Override/);
  assert.match(projectFields, /Manager Override/);
  assert.match(projectFields, /Agent Sales Rate/);
});

test('account history uses the same listing alias emitted by the lookup helper', async () => {
  const source = await readSource('../controllers/Lot_Projects/Accounts/Accounts.controller.js');

  assert.match(source, /getListingLookupWhere\(clean\(req\.params\.listingId\), 'listing'\)/);
  assert.match(source, /FROM lot_project_listings listing/);
  assert.match(source, /\[AccountHistory\]/);
});

test('document views share safe file normalization and protected asset handling', async () => {
  const [documents, modal, utilities, mapper] = await Promise.all([
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/Documents/Documents.jsx'),
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/Documents/DocumentImagesModal.jsx'),
    readSource('../../client/src/components/Lot_Projects/ListingProfileComponents/Documents/documentFileUtils.js'),
    readSource('../controllers/Lot_Projects/_shared/lotProject.shared.js'),
  ]);

  assert.match(documents, /from '\.\/documentFileUtils'/);
  assert.match(modal, /from '\.\/documentFileUtils'/);
  assert.match(utilities, /export const getDocumentImageUrl/);
  assert.match(utilities, /export const isProtectedDocumentFile/);
  assert.match(mapper, /imageCount: imageEntries\.length/);
});

test('listing profile tabs and routes have user-facing error recovery', async () => {
  const [app, profile, boundary, routeError] = await Promise.all([
    readSource('../../client/src/App.jsx'),
    readSource('../../client/src/pages/Lot_Projects/ListingProfile.jsx'),
    readSource('../../client/src/components/Shared/TabErrorBoundary.jsx'),
    readSource('../../client/src/components/Shared/RouteErrorPage.jsx'),
  ]);

  assert.match(app, /errorElement=\{<RouteErrorPage/);
  assert.match(profile, /<TabErrorBoundary/);
  assert.match(boundary, /This tab could not be displayed/);
  assert.match(routeError, /Reload Page/);
});
