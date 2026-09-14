import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')
const modalPath = path.join(repoRoot, 'client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx')

test('eligible live commission shows next release date when release action is date-locked', async () => {
  const source = await fs.readFile(modalPath, 'utf8')
  assert.match(source, /const releaseDateLocked = \['Eligible', 'Earned on Cancellation'\]\.includes\(stage\.status\)/)
  assert.match(source, /disabled=\{isSaving \|\| releaseDateLocked\}/)
  assert.match(source, /Not a release date yet\. Next release date: \{releaseDateInfo\.nextReleaseDate \|\| '-'\}\./)
})
