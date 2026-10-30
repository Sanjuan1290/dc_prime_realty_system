import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..', '..')
const clientRoot = path.join(root, 'CLIENT', 'SYSTEM', 'src')

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name)
  return entry.isDirectory() ? walk(full) : [full]
}).filter((file) => /\.(?:js|jsx|ts|tsx)$/.test(file))

const mutationCallPattern = /\b(useFetchPost|useFetchPut|useFetchPatch|useFetchDelete|postApi|putApi|patchApi|deleteApi|postJson|putJson|patchJson|deleteJson)\s*\(/g

test('all client API mutation call sites explicitly declare their confirmation policy', () => {
  const issues = []
  for (const file of walk(clientRoot)) {
    const rel = path.relative(root, file).replace(/\\/g, '/')
    if (rel.endsWith('CLIENT/SYSTEM/src/utils/useFetch.js')) continue
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
    if (rel.endsWith('CLIENT/SYSTEM/src/utils/apiClient.js')) continue
    const source = fs.readFileSync(file, 'utf8')
    const pattern = /\bfetch\(([^,\n]+),\s*\{[\s\S]{0,500}?method:\s*['\"](POST|PUT|PATCH|DELETE)['\"]/g
    for (const match of source.matchAll(pattern)) mutations.push({ rel, target: match[1].trim(), method: match[2] })
  }
  // Direct mutations are permitted only for approved, server-signed Cloudinary uploads.
  // New upload features require an explicit entry here; a raw API mutation must fail.
  const approvedUploadModals = new Set([
    'CLIENT/SYSTEM/src/components/Shared/SignedCopyUploadModal.jsx',
    'CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/SignedSalaryReceiptsModal.jsx',
    'CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/PaymentProofModal.jsx',
    'CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/Documents/UploadDocumentModal.jsx',
  ])
  const isApprovedUpload = ({ rel, target, method }) =>
    approvedUploadModals.has(rel) &&
    target === 'signed.uploadUrl' &&
    method === 'POST'
  const unauthorizedMutations = mutations.filter((mutation) => !isApprovedUpload(mutation))
  assert.deepEqual(unauthorizedMutations, [], 'Found an unapproved direct browser mutation')
  assert.ok(mutations.some((mutation) => mutation.rel.endsWith('/SignedSalaryReceiptsModal.jsx') && isApprovedUpload(mutation)), 'Signed salary uploads must use the approved, server-signed upload URL')
  // This guard must still reject direct API writes and unsigned upload targets.
  assert.equal(isApprovedUpload({ rel: 'CLIENT/SYSTEM/src/pages/System/Employees.jsx', target: 'signed.uploadUrl', method: 'POST' }), false)
  assert.equal(isApprovedUpload({ rel: 'CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/SignedSalaryReceiptsModal.jsx', target: '/api/payrolls', method: 'POST' }), false)
  assert.equal(isApprovedUpload({ rel: 'CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/SignedSalaryReceiptsModal.jsx', target: 'signed.uploadUrl', method: 'DELETE' }), false)
})





