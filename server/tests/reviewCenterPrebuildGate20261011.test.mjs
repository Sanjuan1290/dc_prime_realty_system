import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const gate = path.join(root, 'client/scripts/check-review-center-scope.mjs')
const reviewFile = path.join(root, 'client/src/pages/System/ReviewCenter.jsx')
const runGate = (file) => spawnSync(process.execPath, [gate, file], { encoding: 'utf8' })

test('frontend build runs the Review Center scope guard before Vite', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'client/package.json'), 'utf8'))
  assert.equal(pkg.scripts.prebuild, 'node scripts/check-review-center-scope.mjs')
  assert.equal(pkg.scripts.build, 'vite build')
})

test('guard accepts the corrected source and rejects a reintroduced undefined counts reference', () => {
  const good = runGate(reviewFile)
  assert.equal(good.status, 0, good.stderr || good.stdout)
  const source = fs.readFileSync(reviewFile, 'utf8')
  const target = 'Dedicated review workspace</p></div>'
  assert.ok(source.includes(target))
  const broken = source.replace(target, `${target}
    {(counts.notificationCountsAvailable === false) ? null : null}`)
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dcprime-review-guard-'))
  try {
    const file = path.join(temp, 'ReviewCenter.jsx')
    fs.writeFileSync(file, broken)
    const result = runGate(file)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /ReviewDetails accesses counts/)
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})


test('guard rejects accidental notification or History feature removals', () => {
  const source = fs.readFileSync(reviewFile, 'utf8')
  const variants = [
    [source.replace('Mark All as Read', 'Read notifications'), 'bulk-read'],
    [source.replace('>History</button>', '>History &amp; Tracking</button>'), 'History'],
  ]
  for (const [broken, label] of variants) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dcprime-review-feature-'))
    try {
      const file = path.join(temp, 'ReviewCenter.jsx')
      fs.writeFileSync(file, broken)
      const result = runGate(file)
      assert.notEqual(result.status, 0, label)
    } finally { fs.rmSync(temp, { recursive: true, force: true }) }
  }
})
