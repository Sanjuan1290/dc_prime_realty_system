import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../../client/src/components/Shared/DoubleCheckComponents/SellerGroupDoubleCheck.jsx', import.meta.url), 'utf8')

test('Network Final Double-Check step is named Commission Allocation', () => {
  assert.match(source, /key: 'rates',\s*title: 'Commission Allocation'/)
  assert.doesNotMatch(source, /title: 'Project Allocation'/)
})

test('Network Final Double-Check section uses the same Commission Allocation heading', () => {
  assert.match(source, /<DoubleCheckSection title="Commission Allocation"/)
  assert.doesNotMatch(source, /title="Project Commission Allocation"/)
})

test('Project-rate details and review flow remain unchanged', () => {
  assert.match(source, /rates\.map\(\(rate, index\) =>/)
  assert.match(source, /Company Profit \(CP\)/)
  assert.match(source, /Distributable Pool/)
  assert.match(source, /Division Manager/)
  assert.match(source, /Sales Director/)
  assert.match(source, /Unit Manager/)
  assert.match(source, /Sales Agent/)
  assert.match(source, /onConfirm=\{onConfirm\} onCancel=\{onCancel\}/)
})
