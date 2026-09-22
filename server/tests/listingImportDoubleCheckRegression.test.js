import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8')

test('listing import and reservation correction are registered Final Double-Check types', () => {
  const source = read('client/src/utils/doubleCheck.js')
  assert.match(source, /'listing-import'/)
  assert.match(source, /'listing-import-reversal'/)
  assert.match(source, /'reservation-correction'/)
})

test('client-side Final Double-Check errors are not mislabeled as server outages', () => {
  // Normalize line endings so this source-order regression test behaves the
  // same on Windows (CRLF) and Unix/macOS (LF) checkouts.
  const source = read('client/src/utils/apiClient.js').replace(/\r\n/g, '\n')
  const confirmationIndex = source.indexOf('await requireMutationConfirmation({')
  const networkTryIndex = source.indexOf('try {\n    controller = new AbortController()', confirmationIndex)
  assert.ok(confirmationIndex >= 0, 'confirmation step should exist')
  assert.ok(networkTryIndex > confirmationIndex, 'confirmation must complete before entering network error handling')
  assert.match(source, /CLIENT_CONFIRMATION_ERROR/)
})


