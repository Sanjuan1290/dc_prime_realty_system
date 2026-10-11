import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = fs.readFileSync(path.join(repoRoot, 'client/src/pages/System/ReviewCenter.jsx'), 'utf8')
const match = source.match(/const fmtDate = \(value\) => \{[\s\S]*?\n\}\nconst statusClass/)
assert.ok(match, 'Review Center formatter must exist')
const functionText = match[0].replace(/\nconst statusClass$/, '')
const fmtDate = new Function(`${functionText}\nreturn fmtDate`)()

const samples = [
  ['2026-10-11 04:53:00', 'Oct 11, 2026, 12:53 PM PHT'],
  ['2026-10-11 03:48:00', 'Oct 11, 2026, 11:48 AM PHT'],
  ['2026-10-11 03:47:00', 'Oct 11, 2026, 11:47 AM PHT'],
  ['2026-10-11 03:12:00', 'Oct 11, 2026, 11:12 AM PHT'],
  ['2026-10-11 03:08:00', 'Oct 11, 2026, 11:08 AM PHT'],
  ['2026-10-11T04:53:00', 'Oct 11, 2026, 12:53 PM PHT'],
  ['2026-10-11T04:53:00Z', 'Oct 11, 2026, 12:53 PM PHT'],
  ['2026-10-11T12:53:00+08:00', 'Oct 11, 2026, 12:53 PM PHT'],
  ['2026-10-11T04:53:00.123Z', 'Oct 11, 2026, 12:53 PM PHT'],
  ['2026-10-11T23:30:00Z', 'Oct 12, 2026, 7:30 AM PHT'],
]

for (const [input, expected] of samples) {
  test(`review timestamp ${input} displays correct Philippine time`, () => {
    assert.equal(fmtDate(input), expected)
  })
}

test('invalid or missing date is displayed safely', () => {
  assert.equal(fmtDate('not-a-date'), '—')
  assert.equal(fmtDate(null), '—')
  assert.equal(fmtDate(''), '—')
})

test('Review Center calls the same formatter for list, details, events, notices and approval timestamps', () => {
  assert.match(source, /fmtDate\(row\.created_at\)/)
  assert.match(source, /fmtDate\(event\.created_at\)/)
  assert.match(source, /fmtDate\(row\.reviewed_at\)/)
  assert.match(source, /fmtDate\(row\.used_at\)/)
  assert.ok((source.match(/fmtDate\(/g) || []).length >= 6)
})

test('formatting is independent of local browser/server timezone', () => {
  for (const tz of ['UTC', 'Asia/Manila', 'America/Los_Angeles']) {
    const script = `${functionText}\nprocess.stdout.write(fmtDate('2026-10-11 04:53:00'))`
    const run = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' })
    assert.equal(run.status, 0, `${tz}: ${run.stderr}`)
    assert.equal(run.stdout, 'Oct 11, 2026, 12:53 PM PHT', tz)
  }
})
