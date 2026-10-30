import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { classifyListingWorkbook } from '../../../CLIENT/SYSTEM/src/utils/listingWorkbookType.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const fakeXLSX = { utils: { sheet_to_json: (sheet, options) => options?.header === 1 ? [sheet.headers] : [] } }
const workbook = (headers, withOriginal = false) => ({
  SheetNames: ['Listings', ...(withOriginal ? ['Original Values'] : [])],
  Sheets: { Listings: { headers }, ...(withOriginal ? { 'Original Values': { headers } } : {}) },
})

const inventoryHeaders = ['Listing ID','Project ID','Status','Contract Protection','Unit ID','Old Unit IDs','Lot Area SQM','Installment Price / SQM','Cash Price / SQM']
const newListingHeaders = ['Cadastral Lot No.','Unit ID *','Old Unit IDs','Lot Type *','Reservation Fee','Price / SQM — Installment *','Price / SQM — Cash *','Lot Area SQM *','Legal / Misc Rate (%)']

test('bulk-edit workbook is not mistaken for new-unit import, regardless of 63 inventory rows', () => {
  assert.equal(classifyListingWorkbook(workbook(inventoryHeaders, true), fakeXLSX), 'bulk-edit')
  assert.equal(classifyListingWorkbook(workbook(inventoryHeaders), fakeXLSX), 'inventory-export')
  assert.equal(classifyListingWorkbook(workbook(newListingHeaders), fakeXLSX), 'new-listings')
  assert.equal(classifyListingWorkbook(workbook(['Unit ID','Cash Price / SQM']), fakeXLSX), 'invalid')
})

test('new import checks file type before validating rows; offers direct Bulk Edit navigation', () => {
  const importer = read('../../../CLIENT/SYSTEM/src/components/Lot_Projects/ListingComponents/ListingImportModal/ListingImportModal.jsx')
  const detection = importer.indexOf('classifyListingWorkbook(workbook, XLSX)')
  const rowConversion = importer.indexOf('sheet_to_json(workbook.Sheets[sheetName]')
  const submit = importer.indexOf('listing-imports/validate')
  assert.ok(detection >= 0 && detection < rowConversion && rowConversion < submit)
  assert.match(importer, /This file contains existing listings/)
  assert.match(importer, /Open Bulk Edit Existing Listings/)
  assert.match(importer, /onOpenBulkEdit/)
  assert.match(importer, /The Excel columns do not match the New Listings template/)
})

test('Bulk Edit runs on a project-scoped page instead of an overlay modal, and warning banner is gone', () => {
  const app = read('../../../CLIENT/SYSTEM/src/App.jsx')
  const page = read('../../../CLIENT/SYSTEM/src/pages/Lot_Projects/BulkEditListings.jsx')
  const workspace = read('../../../CLIENT/SYSTEM/src/components/Lot_Projects/ListingComponents/BulkEditListingsModal.jsx')
  const listings = read('../../../CLIENT/SYSTEM/src/pages/Lot_Projects/Listings.jsx')
  assert.match(app, /path="listings\/bulk-edit" element=\{protect\(PERMISSIONS\.LOT_LISTINGS_EDIT/)
  assert.match(page, /onSaved=/)
  assert.match(page, /queryClient\.invalidateQueries/)
  assert.match(workspace, /setPreviewPageSize\] = useState\(10\)/)
  assert.match(workspace, /<th scope=\"col\" className=\"w-\[23%\] p-3\">Unit ID<\/th>/)
  assert.match(workspace, />Fields<\/th>/)
  assert.match(workspace, />Before<\/th>/)
  assert.match(workspace, />After<\/th>/)
  assert.match(workspace, /Search unit ID, field, or value/)
  assert.match(workspace, /Expand page/)
  assert.match(workspace, /Collapse page/)
  assert.match(workspace, /aria-expanded=\{expanded\}/)
  assert.match(workspace, /paginateBulkPreview\(matchingPreview, previewPage, previewPageSize\)/)
  assert.doesNotMatch(workspace, /Changed Values/)
  assert.doesNotMatch(workspace, /fixed inset-0 z-\[80\]/)
  assert.doesNotMatch(workspace, /Sold, fully paid and cancelled units: only Unit ID/)
  assert.match(listings, /\/listings\/bulk-edit/)
})

test('Internal Notifications uses server pagination, account-specific cache and retains global mark-all-read', () => {
  const ui = read('../../../CLIENT/SYSTEM/src/pages/System/ReviewCenter.jsx')
  const server = read('../controllers/System/workflow.controller.js')
  assert.match(ui, /const \[notificationPage, setNotificationPage\] = useState\(1\)/)
  assert.match(ui, /notificationPageSize = 10/)
  assert.match(ui, /'workflow-notifications', actor\.id \|\| 0, actor\.role \|\| '', notificationPage/)
  assert.match(ui, /workflow\/notifications\?limit=\$\{notificationPageSize\}&page=\$\{notificationPage\}/)
  assert.match(ui, /notifications\.data\?\.pagination\?\.total/)
  assert.match(ui, /Internal Notifications pages/)
  assert.match(ui, /Mark All as Read/)
  assert.match(server, /const \{ page,limit \} = pageValues\(req\.query\)/)
  assert.match(server, /LIMIT \? OFFSET \?/)
  assert.match(server, /markVisibleInternalNotificationsRead/)
})


