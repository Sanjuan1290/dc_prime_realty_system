import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('parent project rates only seed missing child-parent overrides', async () => {
  const source = await readSource('../controllers/System/sellerCommissionRates.service.js');

  assert.match(source, /INSERT IGNORE INTO seller_hierarchy_lot_project_overrides/);
  assert.match(source, /Existing child-to-parent overrides are relationship-specific/);
  assert.doesNotMatch(
    source,
    /UPDATE seller_hierarchy_lot_project_overrides\s+SET override_rate = \?/s
  );
  assert.match(source, /ON DUPLICATE KEY UPDATE\s+override_rate_status = 'active'/s);
});

test('commission path endpoint updates an exact child-parent-project edge', async () => {
  const [controller, router] = await Promise.all([
    readSource('../controllers/System/sellerGroup.controller.js'),
    readSource('../routers/System/sellerGroup.routers.js'),
  ]);

  assert.match(controller, /const upsertRelationshipOverride/);
  assert.match(controller, /child_accredited_seller_id,\s+parent_accredited_seller_id,\s+lot_project_id/s);
  assert.match(controller, /export const updateAgentCommissionPath/);
  assert.match(controller, /relationship-specific commission path/);
  assert.match(router, /agents\/:agentId\/path/);
});

test('seller group UI edits complete paths instead of one global parent override', async () => {
  const [page, modal] = await Promise.all([
    readSource('../../client/src/pages/System/SellerGroupDetails.jsx'),
    readSource('../../client/src/components/System/sellerGroupComponents/CommissionPathModal.jsx'),
  ]);

  assert.match(page, /Commission Paths/);
  assert.match(page, /Edit Path/);
  assert.match(page, /agents\/\$\{agentId\}\/path/);
  assert.match(modal, /Edit Commission Path/);
  assert.match(modal, /This rate only applies to the/);
  assert.match(modal, /Save Commission Path/);
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
