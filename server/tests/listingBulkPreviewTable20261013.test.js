import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  BULK_PREVIEW_PAGE_SIZES,
  bulkPreviewFields,
  bulkPreviewValue,
  filterBulkPreview,
  paginateBulkPreview,
} from '../../client/src/utils/listingBulkPreview.js'

const makeRow = (id, unit, changes) => ({
  listingId: id,
  status: id % 2 ? 'Available' : 'Sold / Active',
  before: { unitCode: unit },
  after: { unitCode: unit },
  changes,
})

const examples = [
  makeRow(1, 'LA-0208', {
    lotAreaSqm: { before: 300, after: 322 },
    installmentPricePerSqm: { before: 1555, after: 1600 },
    cashPricePerSqm: { before: 1222, after: 1200 },
  }),
  makeRow(2, 'LA-0401', { cashPricePerSqm: { before: 1500, after: 1800 } }),
  makeRow(3, 'LA-0711', { unitCode: { before: 'LA-0711', after: 'LA-0711A' } }),
]

test('four-column preview retains separate before and after values for each changed field', () => {
  const fields = bulkPreviewFields(examples[0])
  assert.deepEqual(fields, [
    { key: 'lotAreaSqm', label: 'Lot Area (SQM)', before: '300', after: '322' },
    { key: 'installmentPricePerSqm', label: 'Installment Price / SQM', before: '1555', after: '1600' },
    { key: 'cashPricePerSqm', label: 'Cash Price / SQM', before: '1222', after: '1200' },
  ])
  assert.equal(bulkPreviewValue(null), '—')
  assert.equal(bulkPreviewValue(0), '0')
  assert.equal(bulkPreviewValue(['LA-101', 'LA-102']), 'LA-101, LA-102')
})

test('search finds matching units, field labels, original values and edited values', () => {
  assert.deepEqual(filterBulkPreview(examples, 'LA-0208'), [examples[0]])
  assert.deepEqual(filterBulkPreview(examples, 'la-0711a'), [examples[2]])
  assert.deepEqual(filterBulkPreview(examples, 'lot area'), [examples[0]])
  assert.deepEqual(filterBulkPreview(examples, '1800'), [examples[1]])
  assert.deepEqual(filterBulkPreview(examples, '  CASH PRICE  '), [examples[0], examples[1]])
  assert.deepEqual(filterBulkPreview(examples, 'missing'), [])
  assert.deepEqual(filterBulkPreview(examples, ''), examples)
  // Searching is read-only; the dataset for final confirmation is not modified.
  assert.equal(examples.length, 3)
})

test('pagination scales to 63 edited units without dropping or duplicating entries', () => {
  const sixtyThree = Array.from({ length: 63 }, (_, i) => makeRow(i + 1, `LA-${1000 + i}`, { lotAreaSqm: { before: 100, after: 200 } }))
  assert.deepEqual(BULK_PREVIEW_PAGE_SIZES, [10, 25, 50, 100])
  const pages = Array.from({ length: 7 }, (_, i) => paginateBulkPreview(sixtyThree, i + 1, 10))
  assert.deepEqual(pages.map((x) => x.items.length), [10, 10, 10, 10, 10, 10, 3])
  assert.deepEqual(pages.flatMap((x) => x.items.map((r) => r.listingId)), sixtyThree.map((r) => r.listingId))
  assert.equal(pages[6].from, 61)
  assert.equal(pages[6].to, 63)
  assert.equal(pages[6].totalPages, 7)
  assert.equal(paginateBulkPreview(sixtyThree, 999, 25).page, 3)
  assert.equal(paginateBulkPreview([], 3).from, 0)
  assert.equal(paginateBulkPreview([], 3).totalPages, 1)
})

test('UI offers search, 4 named columns, page sizing, row expand/collapse and confirmation of all rows', () => {
  const component = readFileSync(new URL('../../client/src/components/Lot_Projects/ListingComponents/BulkEditListingsModal.jsx', import.meta.url), 'utf8')
  for (const label of ['Unit ID', 'Fields', 'Before', 'After']) assert.match(component, new RegExp(`>${label}<\\/th>`))
  assert.match(component, /Search unit ID, field, or value/)
  assert.match(component, /aria-expanded=\{expanded\}/)
  assert.match(component, /expanded && fields\.map\(\(field\)/)
  assert.match(component, /\+\{fields\.length - 1\} more/)
  assert.match(component, /Expand page/)
  assert.match(component, /Collapse page/)
  assert.match(component, /Rows per page/)
  assert.match(component, /visiblePreview\.totalPages/)
  assert.match(component, /Confirmation applies every validated change in the workbook/)
  assert.match(component, /\{ rows, filename, reason: reason\.trim\(\) \}/)
})

