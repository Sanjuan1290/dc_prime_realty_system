import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

test('undo-import history uses server-side pagination and never truncates the oldest batches at 25', () => {
  const code = read('SERVER/SYSTEM/controllers/System/sellerGroup.controller.js')
  const handler = code.match(/export const getNetworkMemberImportHistory = async \(req, res\) => \{[\s\S]*?\n\};/)
  assert.ok(handler, 'Import history handler must be available')
  const src = handler[0]
  assert.match(src, /Number\.isSafeInteger\(page\)/)
  assert.match(src, /const pageSize = 5/)
  assert.match(src, /COUNT\(\*\) AS total/)
  assert.match(src, /LIMIT \? OFFSET \?/)
  assert.match(src, /\(page - 1\) \* pageSize/)
  assert.match(src, /return res\.json\(\{ success: true, data: history, page, pageSize, total, totalPages \}\)/)
  assert.doesNotMatch(src, /LIMIT 25/)
  assert.match(src, /getImportUndoEligibility\(connection, entry\)/)
})

test('undo-import modal pages server results, keeps confirmation tied to exact batch and distinguishes errors from empty history', () => {
  const src = read('CLIENT/SYSTEM/src/components/System/sellerGroupComponents/NetworkMemberImportHistoryModal.jsx')
  assert.match(src, /queryKey: \['network-member-import-history', groupId, page\]/)
  assert.match(src, /\/members\/import\/history\?page=\$\{page\}/)
  assert.match(src, /Import history pages/)
  assert.match(src, /goToPage\(page - 1\)/)
  assert.match(src, /goToPage\(page \+ 1\)/)
  assert.match(src, /historyQuery\.isError/)
  assert.match(src, /historyQuery\.isPending/)
  assert.match(src, /setSelected\(null\)/)
  assert.match(src, /confirmation\.trim\(\) !== `UNDO \$\{selected\.batch_id\}`/)
  assert.match(src, /confirmationHandled: 'compact'/)
})

