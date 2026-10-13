import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8')
const apiSource = read('../../client/src/utils/apiClient.js')
const exportModal = read('../../client/src/components/Lot_Projects/ListingComponents/ExportListingsModal.jsx')
const editModal = read('../../client/src/components/Lot_Projects/ListingComponents/BulkEditListingsModal.jsx')
const router = read('../routers/System/projects.routers.js')

// Execute the real request-confirmation implementation and technical allowlist.
// Merely checking for text in apiClient would not catch a malformed path regex.
const patternsStart = apiSource.indexOf('const TECHNICAL_MUTATION_PATTERNS = [')
const patternsEnd = apiSource.indexOf('\n]', patternsStart)
const guardStart = apiSource.indexOf('const requireMutationConfirmation = async (')
const guardEnd = apiSource.indexOf('\nexport const requestApi =', guardStart)
assert.ok(patternsStart !== -1 && patternsEnd > patternsStart && guardStart > patternsEnd && guardEnd > guardStart)

class TestApiError extends Error {
  constructor(message, metadata) {
    super(message)
    this.status = metadata.status
    this.code = metadata.code
  }
}
const evaluateGuard = new Function(
  'ApiError', 'MUTATING_METHODS', 'CONFIRMATION_POLICIES',
  'consumeDoubleCheckToken', 'requestDoubleCheck', 'parseRequestBody',
  `${apiSource.slice(patternsStart, patternsEnd + 2)}\n${apiSource.slice(guardStart, guardEnd)}\nreturn requireMutationConfirmation`,
)
const guard = evaluateGuard(
  TestApiError,
  new Set(['POST', 'PUT', 'PATCH', 'DELETE']),
  new Set(['compact', 'technical']),
  () => false,
  async () => { throw new Error('Unexpected Final Double-Check') },
  (input) => input,
)
const check = (path, confirmationHandled = 'technical', method = 'POST') => guard({
  normalizedPath: path,
  method,
  body: '{}',
  doubleCheck: null,
  confirmationHandled,
  confirmationToken: '',
})

const projectPath = '/projects/lot-projects/bailen-2026'

test('Excel export audit and preview-only validation pass technical guard', async () => {
  await assert.doesNotReject(() => check(`${projectPath}/listing-bulk/export-audit`))
  await assert.doesNotReject(() => check(`${projectPath}/listing-bulk/validate`))
  // Moving the Price List did not break the existing print-audit operation.
  await assert.doesNotReject(() => check(`${projectPath}/price-list/print-audit`))
})

test('bulk apply and other listing writes cannot bypass review using technical policy', async () => {
  for (const path of [
    `${projectPath}/listing-bulk/apply`,
    `${projectPath}/listing-bulk/delete`,
    `${projectPath}/listing-bulk/export-audit/other`,
    `${projectPath}/listing-bulk/validate/other`,
    `${projectPath}/listings/50010`,
  ]) {
    await assert.rejects(() => check(path), (error) => {
      assert.equal(error.code, 'TECHNICAL_MUTATION_NOT_ALLOWED', path)
      return true
    })
  }
  await assert.doesNotReject(() => check(`${projectPath}/listing-bulk/apply`, 'compact'))
  await assert.rejects(() => check(`${projectPath}/listing-bulk/apply`, ''), (error) => {
    assert.equal(error.code, 'MUTATION_CONFIRMATION_REQUIRED')
    return true
  })
})

test('UI requests use the correct policies and require a validated preview for apply', () => {
  assert.match(exportModal, /listing-bulk\/export-audit[^\n]*confirmationHandled: 'technical'/)
  assert.match(exportModal, /price-list\/print-audit[^\n]*confirmationHandled: 'technical'/)
  assert.match(editModal, /listing-bulk\/validate[^\n]*confirmationHandled: 'technical'/)
  assert.match(editModal, /listing-bulk\/apply[^\n]*confirmationHandled: 'compact'/)
  assert.doesNotMatch(editModal, /listing-bulk\/apply[^\n]*confirmationHandled: 'technical'/)
  assert.match(editModal, /if \(!preview\?\.valid \|\| !preview\.changedCount \|\| busy\) return/)
  assert.match(editModal, /Confirm \$\{preview\?\.changedCount \|\| 0\} Listing Changes/)
})

test('server permissions still protect each endpoint', () => {
  assert.match(router, /listing-bulk\/export-audit', requirePermission\(PERMISSIONS\.LOT_LISTINGS_VIEW\)/)
  assert.match(router, /listing-bulk\/validate', requirePermission\(PERMISSIONS\.LOT_LISTINGS_EDIT\)/)
  assert.match(router, /listing-bulk\/apply', requirePermission\(PERMISSIONS\.LOT_LISTINGS_EDIT\)/)
})
