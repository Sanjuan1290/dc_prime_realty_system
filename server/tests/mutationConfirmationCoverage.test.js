import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const clientRoot = path.join(root, 'client', 'src')

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name)
  return entry.isDirectory() ? walk(full) : [full]
}).filter((file) => /\.(?:js|jsx|ts|tsx)$/.test(file))

const mutationCallPattern = /\b(useFetchPost|useFetchPut|useFetchPatch|useFetchDelete|postApi|putApi|patchApi|deleteApi|postJson|putJson|patchJson|deleteJson)\s*\(/g

test('all client API mutation call sites explicitly declare their confirmation policy', () => {
  const issues = []
  for (const file of walk(clientRoot)) {
    const rel = path.relative(root, file).replace(/\\/g, '/')
    if (rel.endsWith('client/src/utils/useFetch.js')) continue
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(mutationCallPattern)) {
      const snippet = source.slice(match.index, Math.min(source.length, match.index + 1800))
      if (!/doubleCheck\s*:|confirmationHandled\s*:|confirmationToken\s*:/.test(snippet)) {
        issues.push(`${rel}:${source.slice(0, match.index).split('\n').length} ${match[1]}`)
      }
    }
  }
  assert.deepEqual(issues, [])
})

test('direct browser mutations are limited to signed external upload URLs', () => {
  const mutations = []
  for (const file of walk(clientRoot)) {
    const rel = path.relative(root, file).replace(/\\/g, '/')
    if (rel.endsWith('client/src/utils/apiClient.js')) continue
    const source = fs.readFileSync(file, 'utf8')
    const pattern = /fetch\(([^,\n]+),\s*\{[\s\S]{0,500}?method:\s*['\"](POST|PUT|PATCH|DELETE)['\"]/g
    for (const match of source.matchAll(pattern)) mutations.push({ rel, target: match[1].trim(), method: match[2] })
  }
  assert.equal(mutations.length, 3)
  for (const mutation of mutations) {
    assert.match(mutation.rel, /UploadDocumentModal\.jsx|PaymentProofModal\.jsx|SignedCopyUploadModal\.jsx/)
    assert.equal(mutation.target, 'signed.uploadUrl')
    assert.equal(mutation.method, 'POST')
  }
})
