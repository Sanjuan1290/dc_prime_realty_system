import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('listing import treats cadastral lot number as optional', () => {
  const controller = read('server/controllers/Lot_Projects/Listings/ListingImports.controller.js')
  const modal = read('client/src/components/Lot_Projects/ListingComponents/ListingImportModal/ListingImportModal.jsx')

  assert.doesNotMatch(controller, /Cadastral Lot No\. is required\./)
  assert.match(controller, /if \(cadastralLots\.length > 1\)/)
  assert.match(controller, /const missingLots = cadastralLots\.filter/)
  const headersStart = modal.indexOf('const HEADERS = [')
  const headersEnd = modal.indexOf(']', headersStart)
  const headersSource = modal.slice(headersStart, headersEnd + 1)
  assert.match(headersSource, /'Cadastral Lot No\.'/)
  assert.doesNotMatch(headersSource, /'Cadastral Lot No\. \*'/)
  assert.match(modal, /Optional\. Leave blank when the listing has no cadastral lot\./)
  assert.match(modal, /Valid Cadastral Lot No\. \(Optional\)/)

  // Download Project Template must keep Unit IDs as text so values like 0201
  // are not converted by Excel to 201 before the file is imported.
  assert.match(modal, /for \(let row = 1; row <= MAX_IMPORT_ROWS; row \+= 1\)/)
  assert.match(modal, /c: 1/)
  assert.match(modal, /z: '@'/)
  assert.match(modal, /numFmt: '@'/)
  assert.match(modal, /Unit ID column is formatted as Text so leading zeroes are preserved/)
})
