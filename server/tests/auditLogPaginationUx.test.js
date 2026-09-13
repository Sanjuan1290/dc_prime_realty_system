import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('Audit Trail pagination keeps the current table mounted while an unseen page loads', () => {
  const page = read('client/src/pages/System/AuditLogs.jsx')
  const table = read('client/src/components/System/auditLogsComponents/AuditLogTable.jsx')
  const clientPackage = JSON.parse(read('client/package.json'))

  assert.match(String(clientPackage.dependencies?.['@tanstack/react-query'] || ''), /^\^5\./)
  assert.match(page, /placeholderData:\s*\(previousData\)\s*=>\s*previousData/)
  assert.doesNotMatch(page, /keepPreviousData:\s*true/)
  assert.match(page, /isPageChanging=\{isFetching && isPlaceholderData\}/)
  assert.match(table, /Loading page \{page\}\.\.\./)
  assert.match(table, /disabled=\{isPageChanging \|\| page <= 1\}/)
  assert.match(table, /disabled=\{isPageChanging \|\| page >= totalPages\}/)
})
