import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const api = read('../../../CLIENT/SYSTEM/src/utils/apiClient.js')
const bulk = read('../../../CLIENT/SYSTEM/src/components/System/sellerGroupComponents/BulkEditMembersModal.jsx')
const restore = read('../../../CLIENT/SYSTEM/src/components/System/sellerGroupComponents/RestoreManagerReplacementModal.jsx')
const replace = read('../../../CLIENT/SYSTEM/src/components/System/sellerGroupComponents/ReplaceManagerModal.jsx')
const replacementService = read('../services/sellerManagerReplacement.service.js')

// Run the same confirmation guard and allowlist that are used before fetch.
const a = api.indexOf('const TECHNICAL_MUTATION_PATTERNS = [')
const b = api.indexOf('\n]', a)
const c = api.indexOf('const requireMutationConfirmation = async (')
const d = api.indexOf('\nexport const requestApi =', c)
assert.ok(a !== -1 && b > a && c > b && d > c)
class TestApiError extends Error {
  constructor(message, metadata) { super(message); this.code = metadata.code }
}
const guard = new Function(
  'ApiError', 'MUTATING_METHODS', 'CONFIRMATION_POLICIES',
  'consumeDoubleCheckToken', 'requestDoubleCheck', 'parseRequestBody',
  `${api.slice(a, b + 2)}\n${api.slice(c, d)}\nreturn requireMutationConfirmation`,
)(TestApiError, new Set(['POST', 'PUT', 'PATCH', 'DELETE']), new Set(['compact', 'technical']),
  () => false, async () => { throw new Error('Unexpected double-check') }, (v) => v)
const check = (path, policy) => guard({ normalizedPath: path, method: 'POST', body: '{}',
  doubleCheck: null, confirmationHandled: policy, confirmationToken: '' })

const base = '/seller-groups/90001'

test('bulk preview and restore verification code use technical policies; final saves use compact confirmation', async () => {
  await assert.doesNotReject(() => check(`${base}/members/bulk-edit/preview`, 'technical'))
  await assert.doesNotReject(() => check(`${base}/managers/replacements/123/restore/code`, 'technical'))
  for (const path of [
    `${base}/members/bulk-edit/confirm`,
    `${base}/managers/replacements/123/restore/confirm`,
    `${base}/members/bulk-edit/delete`,
    `${base}/managers/replacements/123/restore/unlock`,
  ]) {
    await assert.rejects(() => check(path, 'technical'), error => {
      assert.equal(error.code, 'TECHNICAL_MUTATION_NOT_ALLOWED', path)
      return true
    })
  }
  await assert.doesNotReject(() => check(`${base}/members/bulk-edit/confirm`, 'compact'))
  await assert.doesNotReject(() => check(`${base}/managers/replacements/123/restore/confirm`, 'compact'))
  await assert.rejects(() => check(`${base}/members/bulk-edit/confirm`, ''), { code: 'MUTATION_CONFIRMATION_REQUIRED' })
})

test('both modals label the four API mutations with the matching confirmation policy', () => {
  assert.match(bulk, /members\/bulk-edit\/preview[^\n]+confirmationHandled: 'technical'/)
  assert.match(bulk, /members\/bulk-edit\/confirm[^\n]+confirmationHandled: 'compact'/)
  assert.match(restore, /\$\{base\}\/code[^\n]+confirmationHandled: 'technical'/)
  assert.match(restore, /\$\{base\}\/confirm[^\n]+confirmationHandled: 'compact'/)
  assert.doesNotMatch(bulk, /bulk-edit\/confirm[^\n]+confirmationHandled: 'technical'/)
  assert.doesNotMatch(restore, /\$\{base\}\/confirm[^\n]+confirmationHandled: 'technical'/)
})


test('manager replacement code is technical, but final replacement uses an explicit in-modal confirmation', async () => {
  await assert.doesNotReject(() => check(`${base}/managers/123/replace/code`, 'technical'))
  await assert.rejects(() => check(`${base}/managers/123/replace/confirm`, 'technical'), { code: 'TECHNICAL_MUTATION_NOT_ALLOWED' })
  await assert.doesNotReject(() => check(`${base}/managers/123/replace/confirm`, 'compact'))
  assert.match(replace, /\$\{api\}\/code[^\n]+confirmationHandled: 'technical'/)
  assert.match(replace, /\}\, \{ confirmationHandled: 'compact' \}\)/)
  assert.doesNotMatch(replace, /\$\{api\}\/confirm[\s\S]{0,450}confirmationHandled: 'technical'/)
})

test('replacement manager search and grouped review are readable and do not change the hierarchy API', () => {
  assert.match(replace, /Search replacement managers/)
  assert.match(replace, /Enter a name or account code/)
  assert.match(replace, /filteredCandidates\.slice\(0, 8\)/)
  assert.match(replace, /Moving in/)
  assert.match(replace, /Already on team/)
  assert.match(replace, /Team after/)
  assert.match(replace, /Confirm combining these teams/)
  assert.match(replace, /will be deactivated/)
  assert.match(replacementService, /accountCode:row\.account_code/)
})

