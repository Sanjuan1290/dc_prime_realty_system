import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const checker = path.join(root, 'server/scripts/check-local-imports.mjs')
const run = (target) => spawnSync(process.execPath, [checker, ...(target ? [target] : [])], { encoding: 'utf8' })

test('Render npm start runs a local-import preflight before boot', () => {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(root, 'server/package.json'), 'utf8'))
  assert.equal(scripts.prestart, 'npm run check:imports')
  assert.equal(scripts['check:imports'], 'node scripts/check-local-imports.mjs')
  const good = run()
  assert.equal(good.status, 0, good.stderr || good.stdout)
})

test('local-import preflight rejects an unresolved JS import', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dcprime-missing-module-'))
  try {
    fs.writeFileSync(path.join(folder, 'sample.js'), "import './buyerFormEmailTemplate.js'\n")
    const result = run(folder)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /buyerFormEmailTemplate.js/)
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})
