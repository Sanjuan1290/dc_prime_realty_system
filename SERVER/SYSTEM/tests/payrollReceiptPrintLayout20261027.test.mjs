import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const receipt = readFileSync(path.join(root, 'CLIENT/SYSTEM/src/components/System/employeeSalaryComponents/FundReleaseReceipt.jsx'), 'utf8')

test('official A4 receipt does not force a 1123px tall print container', () => {
  assert.doesNotMatch(receipt, /min-h-\[1123px\]/)
  assert.match(receipt, /\.fund-release-receipt\.print-export-page\s*\{[\s\S]*?min-height:\s*0\s*!important/)
  assert.match(receipt, /page-break-after:\s*auto\s*!important/)
  assert.match(receipt, /width:\s*210mm\s*!important/)
})

test('receipt table is compact but retains rows, monetary fields and payee data', () => {
  assert.match(receipt, /rows\.map\(\(row\)/)
  assert.match(receipt, /px-2\.5 py-1 align-middle/)
  assert.match(receipt, /receipt\.total_deduction/)
  assert.match(receipt, /receipt\.total\)/)
  assert.match(receipt, /receipt\.amount_in_words/)
  assert.match(receipt, /receipt\.employee_name/)
  assert.match(receipt, /receipt\.witness_name/)
})

test('both signatures stay together in the print document', () => {
  assert.match(receipt, /fund-release-receipt__signatures/)
  assert.match(receipt, /\.fund-release-receipt__signatures,[\s\S]*?page-break-inside:\s*avoid/)
  for (const label of ['Received by:', 'Witness:', 'Signature and Date']) {
    assert.ok(receipt.includes(label), label)
  }
})

test('receipt print style is copied with receipt to its PDF print window', () => {
  assert.match(receipt, /<style>\{`[\s\S]*?@media print/)
  assert.match(receipt, /print-export-page/)
  assert.match(receipt, /fund-release-receipt__amount/)
  assert.match(receipt, /fund-release-receipt__note/)
})

