import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('group rates are stored once per project and legacy individual rates remain disabled', async () => {
  const migration = await readSource('../migrations/20260725_in_house_external_groups_and_role_rename.sql');

  assert.match(migration, /division_manager_rate/);
  assert.match(migration, /sales_director_rate/);
  assert.match(migration, /unit_manager_rate/);
  assert.match(migration, /sales_agent_rate/);
  assert.match(migration, /chk_group_commission_structure_rates/);
  assert.match(migration, /UPDATE lot_project_commissions[\s\S]*commission_role/);
  assert.doesNotMatch(migration, /UPDATE lot_project_commissions[\s\S]*gross_commission_amount/);
});

test('group controller updates the shared group and project rate structure', async () => {
  const [controller, router] = await Promise.all([
    readSource('../controllers/System/sellerGroup.controller.js'),
    readSource('../routers/System/sellerGroup.routers.js'),
  ]);

  assert.match(controller, /validateGroupFixedRateStructure/);
  assert.match(controller, /seller_group_pool_rate = \?/);
  assert.match(controller, /division_manager_rate = \?/);
  assert.match(controller, /sales_director_rate = \?/);
  assert.match(controller, /unit_manager_rate = \?/);
  assert.match(controller, /sales_agent_rate = \?/);
  assert.match(router, /projects\/:projectId\/pool/);
  assert.doesNotMatch(router, /direct-rate/);
  assert.doesNotMatch(router, /agents\/:agentId\/path/);
  assert.doesNotMatch(controller, /upsertHierarchyOverride/);
});

test('group UI shows type-aware project structures and no commission path editor', async () => {
  const [page, projectFields] = await Promise.all([
    readSource('../../client/src/pages/System/SellerGroupDetails.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/ProjectAccreditationFields.jsx'),
  ]);

  assert.match(page, /Project Commission Structure/);
  assert.match(page, /Each member inherits the fixed project rate for their position/);
  assert.doesNotMatch(page, /Commission Paths/);
  assert.doesNotMatch(page, /Edit Path/);
  assert.match(projectFields, /Division Manager Rate/);
  assert.match(projectFields, /Sales Director Rate/);
  assert.match(projectFields, /Unit Manager Rate/);
  assert.match(projectFields, /Sales Agent Rate/);
  assert.match(projectFields, /External Group Commission/);
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

