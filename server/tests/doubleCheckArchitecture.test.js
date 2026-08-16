import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath))

test('generic mutation review renderer is removed and main mounts the explicit DoubleCheck provider', () => {
  assert.equal(exists('client/src/components/Shared/MutationReviewProvider.jsx'), false)
  assert.equal(exists('client/src/utils/mutationReview.js'), false)
  const main = read('client/src/main.jsx')
  assert.match(main, /DoubleCheckProvider/)
  assert.match(main, /InputExampleDecorator/)
  assert.doesNotMatch(main, /MutationReviewProvider/)
})

test('DoubleCheck provider uses an explicit feature registry rather than arbitrary payload introspection', () => {
  const provider = read('client/src/components/Shared/DoubleCheckComponents/core/DoubleCheckProvider.jsx')
  for (const type of [
    'project', 'listing', 'listing-documents', 'reservation', 'buyer-profile', 'user',
    'seller-group', 'document', 'document-template', 'document-upload', 'payment',
    'payment-proof', 'soa-terms', 'penalty-adjustment', 'commission-release',
    'proof-of-income', 'employee', 'attendance', 'cash-advance', 'payroll-release',
    'settings', 'buyer-form', 'audit-archive',
  ]) assert.match(provider, new RegExp(`['\"]?${type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]?\\s*:`))
  assert.doesNotMatch(provider, /buildReviewSections|Object\.entries\(request\?\.data|humanizeKey|inferExample/)
})

test('apiClient blocks unclassified mutations before fetch and supports only explicit review/compact/technical policies', () => {
  const source = read('client/src/utils/apiClient.js')
  const confirmationIndex = source.indexOf('await requireMutationConfirmation')
  const fetchIndex = source.indexOf('const response = await fetch')
  assert.ok(confirmationIndex > -1 && fetchIndex > confirmationIndex)
  assert.match(source, /doubleCheck = null/)
  assert.match(source, /confirmationHandled = ''/)
  assert.match(source, /confirmationToken = ''/)
  assert.match(source, /MUTATION_CONFIRMATION_REQUIRED/)
  assert.match(source, /TECHNICAL_MUTATION_NOT_ALLOWED/)
  assert.match(source, /DOUBLE_CHECK_TOKEN_INVALID/)
  assert.doesNotMatch(source, /describeMutation|buildMutationReviewRequest/)
})

test('review confirmation tokens are one-time and short-lived', () => {
  const source = read('client/src/utils/doubleCheck.js')
  assert.match(source, /TOKEN_TTL_MS\s*=\s*2\s*\*\s*60\s*\*\s*1000/)
  assert.match(source, /issuedTokens\.delete\(value\)/)
  assert.match(source, /consumeDoubleCheckToken/)
  assert.match(source, /isDoubleCheckCancelled/)
})
