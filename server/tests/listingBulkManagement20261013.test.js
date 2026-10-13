import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizedListing, normalizeBulkInput, listingChanges, validateBulkListing, statusFilterSQL, BULK_STATUS_OPTIONS, isContractProtected, getProtectedFieldErrors } from '../controllers/Lot_Projects/Listings/listingBulkFields.js'

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8')

test('status choices exactly preserve seven original price-list filters', () => {
  assert.deepEqual(BULK_STATUS_OPTIONS.map(([value]) => value), [
    'available', 'all', 'hold', 'sold', 'fully_paid', 'pending_for_cancellation', 'cancelled',
  ])
  assert.match(statusFilterSQL('sold').sql, /sold_substatus.*active/)
  assert.match(statusFilterSQL('fully_paid').sql, /fully_paid/)
  assert.deepEqual(statusFilterSQL('all'), { sql: '', params: [] })
  assert.throws(() => statusFilterSQL('invalid'))
})

test('re-survey automatically preserves previous unit IDs without duplicating historical aliases', () => {
  const before = normalizedListing({ lot_project_listing_unit_id: 'LA-0208', lot_project_listing_old_unit_ids: 'LA-0101', lot_project_listing_unit_type: 'Inner', lot_project_listing_area_sqm: 300, lot_project_listing_price_per_sqm: 1300, lot_project_listing_cash_price_per_sqm: 1000 })
  const next = normalizeBulkInput({ ...before, unitCode: 'la-0208a', oldUnitIds: 'LA-0101', lotAreaSqm: 285 }, before)
  assert.equal(next.unitCode, 'LA-0208A')
  assert.equal(next.oldUnitIds, 'LA-0101, LA-0208')
  assert.equal(next.lotAreaSqm, 285)
  assert.deepEqual(Object.keys(listingChanges(before, next)).sort(), ['lotAreaSqm', 'oldUnitIds', 'unitCode'])
  assert.deepEqual(validateBulkListing(next, 'LA'), [])
})

test('invalid pricing, area, aliases and Unit IDs fail validation', () => {
  const item = normalizedListing({ lot_project_listing_unit_id: 'LA-0001', lot_project_listing_unit_type: 'Corner', lot_project_listing_area_sqm: 100, lot_project_listing_price_per_sqm: 1200, lot_project_listing_cash_price_per_sqm: 900 })
  assert.ok(validateBulkListing({ ...item, installmentPricePerSqm: -1 }, 'LA').length)
  assert.ok(validateBulkListing({ ...item, lotAreaSqm: 0 }, 'LA').length)
  assert.ok(validateBulkListing({ ...item, unitCode: 'XX-0001' }, 'LA').length)
  assert.ok(validateBulkListing({ ...item, oldUnitIds: item.unitCode }, 'LA').length)
  assert.ok(validateBulkListing({ ...item, legalMiscRate: 120 }, 'LA').length)
  assert.throws(() => normalizeBulkInput({ ...item, cashPricePerSqm: null }, item))
})

test('bulk endpoints require permissions, not import creation rights', () => {
  const router = read('../routers/System/projects.routers.js')
  assert.match(router, /listing-bulk\/export', requirePermission\(PERMISSIONS\.LOT_LISTINGS_VIEW\)/)
  assert.match(router, /listing-bulk\/validate', requirePermission\(PERMISSIONS\.LOT_LISTINGS_EDIT\)/)
  assert.match(router, /listing-bulk\/apply', requirePermission\(PERMISSIONS\.LOT_LISTINGS_EDIT\)/)
  assert.match(router, /listing-bulk\/history', requirePermission\(PERMISSIONS\.LOT_LISTINGS_EDIT\)/)
  assert.match(router, /listing-bulk\/export-audit', requirePermission\(PERMISSIONS\.LOT_LISTINGS_VIEW\)/)
})

test('bulk edit is transactionally audited and protects buyer contracts', () => {
  const backend = read('../controllers/Lot_Projects/Listings/ListingBulk.controller.js')
  const migration = read('../migrations/20261013_bulk_listing_updates.sql')
  const undo = read('../controllers/Lot_Projects/Listings/ListingImports.controller.js')
  const listings = read('../controllers/Lot_Projects/Listings/Listings.controller.js')
  assert.match(backend, /beginTransaction\(\)/)
  assert.match(backend, /FOR UPDATE/)
  assert.match(backend, /connection\.commit\(\)/)
  assert.match(backend, /createOperationalReview\(/)
  assert.match(backend, /writeAuditLog\(/)
  assert.match(backend, /isContractProtected\(/)
  assert.match(backend, /getProtectedFieldErrors\(/)
  assert.match(backend, /current_account_id/)
  assert.match(backend, /calculateContractPricing/)
  assert.match(backend, /revokeOpenBuyerFormLinks/)
  assert.match(backend, /syncListingDocumentCloudinaryUnitFolder/)
  assert.match(migration, /before_snapshot_json JSON NOT NULL/)
  assert.match(migration, /after_snapshot_json JSON NOT NULL/)
  assert.match(undo, /bulk listing adjustment history/)
  assert.match(listings, /bulk adjustment or re-survey history and cannot be deleted/)
})

test('Dashboard Price List replaced by Listings Export; new and update imports stay separate', () => {
  const dashboard = read('../../client/src/pages/Lot_Projects/Dashboard.jsx')
  const listings = read('../../client/src/pages/Lot_Projects/Listings.jsx')
  const exportModal = read('../../client/src/components/Lot_Projects/ListingComponents/ExportListingsModal.jsx')
  const bulkModal = read('../../client/src/components/Lot_Projects/ListingComponents/BulkEditListingsModal.jsx')
  const excel = read('../../client/src/utils/listingBulkExcel.js')
  assert.doesNotMatch(dashboard, /setShowPriceListModal/)
  assert.match(listings, /Export Listings/)
  assert.match(listings, /Bulk Edit Listings/)
  assert.match(listings, /Import Excel/)
  assert.match(exportModal, /price-list\/print-audit/)
  assert.match(excel, /Original Values/)
  assert.match(excel, /Listing ID/)
  assert.match(excel, /Old Unit IDs/)
  assert.match(bulkModal, /Validate & Preview/)
  assert.match(bulkModal, /Confirm/)
})
