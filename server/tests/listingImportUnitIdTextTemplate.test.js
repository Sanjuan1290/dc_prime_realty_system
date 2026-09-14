import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('listing import Excel template preserves Unit ID leading zeroes as text', () => {
  const source = read('client/src/components/Lot_Projects/ListingComponents/ListingImportModal/ListingImportModal.jsx')

  assert.match(source, /const MAX_IMPORT_ROWS = 5000/)
  assert.match(source, /c: 1/)
  assert.match(source, /z: '@'/)
  assert.match(source, /numFmt: '@'/)
  assert.match(source, /leading zeroes are preserved/)
  assert.match(source, /enter 0101/)
})
