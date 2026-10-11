import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const apiFile = fileURLToPath(new URL('../../client/src/utils/apiClient.js', import.meta.url))
const reviewFile = fileURLToPath(new URL('../../client/src/pages/System/ReviewCenter.jsx', import.meta.url))
const apiSource = fs.readFileSync(apiFile, 'utf8')
const reviewSource = fs.readFileSync(reviewFile, 'utf8')

// Exercise the actual client pre-request confirmation guard with the shipping
// allowlist, not just a regex that checks whether a literal appears in a file.
const patternsStart = apiSource.indexOf('const TECHNICAL_MUTATION_PATTERNS = [')
const patternsEnd = apiSource.indexOf('\n]', patternsStart)
const guardStart = apiSource.indexOf('const requireMutationConfirmation = async (')
const guardEnd = apiSource.indexOf('\nexport const requestApi =', guardStart)
assert.ok(patternsStart >= 0 && patternsEnd > patternsStart && guardStart > 0 && guardEnd > guardStart)
const guardSource = `${apiSource.slice(patternsStart, patternsEnd + 2)}\n${apiSource.slice(guardStart, guardEnd)}`
class TestApiError extends Error {
  constructor(message, meta) { super(message); this.code = meta.code; this.status = meta.status }
}
const guard = new Function('ApiError', 'MUTATING_METHODS', 'CONFIRMATION_POLICIES',
  'consumeDoubleCheckToken', 'requestDoubleCheck', 'parseRequestBody',
  `${guardSource}\nreturn requireMutationConfirmation`)(
    TestApiError,
    new Set(['POST', 'PUT', 'PATCH', 'DELETE']),
    new Set(['compact', 'technical']),
    () => false,
    async () => { throw new Error('Double check is not needed for this test') },
    (value) => value,
  )
const check = (path, policy = 'technical', method = 'PATCH') => guard({
  normalizedPath: path, method, body: '{}', doubleCheck: null,
  confirmationHandled: policy, confirmationToken: '',
})

test('bulk notification read is an explicitly approved technical operation', async () => {
  await assert.doesNotReject(() => check('/workflow/notifications/read-all'))
  await assert.doesNotReject(() => check('/workflow/notifications/1/read'))
})

test('unrelated review decisions and arbitrary workflow mutations remain blocked', async () => {
  for (const path of [
    '/workflow/reviews/60001/head-confirm',
    '/workflow/reviews/60001/return',
    '/workflow/reviews/60001/auditor-verify',
    '/workflow/protected-changes/10/review',
    '/workflow/notifications/read-all/anything',
    '/workflow/notifications/any/read',
    '/workflow/notifications/1/delete',
  ]) {
    await assert.rejects(() => check(path), (error) => {
      assert.equal(error.code, 'TECHNICAL_MUTATION_NOT_ALLOWED', path)
      return true
    })
  }
})

test('Review Center calls bulk and individual read with PATCH and technical policy', () => {
  assert.match(reviewSource, /useFetchPatch\('\/workflow\/notifications\/read-all', \{\}, \{ confirmationHandled: 'technical' \}\)/)
  assert.match(reviewSource, /useFetchPatch\(`\/workflow\/notifications\/\$\{id\}\/read`, \{\}, \{ confirmationHandled: 'technical' \}\)/)
})

test('technical mutation guard remains in front of fetch', () => {
  assert.ok(apiSource.indexOf('await requireMutationConfirmation({') < apiSource.indexOf('const response = await fetch(url, {'))
})
