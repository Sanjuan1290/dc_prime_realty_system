import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { validateReleaseReceiptDetails } from '../services/releaseReceiptDetails.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const valid = Object.freeze({
  bankName: 'BPI', accountNumber: '****1234', receiptDate: '2026-10-12',
  referenceNumber: 'TRF-12', witnessName: 'Accounting Head',
})

test('shared receipt validator accepts complete seller and company payment details', () => {
  assert.deepEqual(validateReleaseReceiptDetails(valid, '2026-10-12', '2026-10-12'), valid)
  assert.equal(validateReleaseReceiptDetails({...valid, receiptDate: '2026-10-13'}, '2026-10-11', '2026-10-13').receiptDate, '2026-10-13')
})

test('receipt details are mandatory, date limited, and reference length bounded', () => {
  for (const key of ['bankName', 'accountNumber', 'referenceNumber', 'witnessName']) {
    assert.throws(() => validateReleaseReceiptDetails({...valid, [key]: ' '}, '2026-10-11', '2026-10-12'), /required/)
  }
  assert.throws(() => validateReleaseReceiptDetails({...valid, referenceNumber:'x'.repeat(121)}, '2026-10-12', '2026-10-12'), /120/)
  assert.throws(() => validateReleaseReceiptDetails({...valid, receiptDate: '2026-10-10'}, '2026-10-11', '2026-10-12'), /Receipt date/)
  assert.throws(() => validateReleaseReceiptDetails({...valid, receiptDate: '2026-10-13'}, '2026-10-11', '2026-10-12'), /Receipt date/)
  assert.throws(() => validateReleaseReceiptDetails({...valid, receiptDate: '2026-02-30'}, '2026-02-01', '2026-10-12'), /Receipt date/)
})

test('seller release includes receipt form BEFORE final double-check', () => {
  const modal=read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx')
  const page=read('client/src/pages/Lot_Projects/Commission.jsx')
  assert.match(modal, /ReleaseReceiptFields value=\{receiptDetails\}/)
  assert.match(modal, /validateReleaseReceipt\(receiptDetails, actualDate\)/)
  assert.match(modal, /receiptDetails,\s*releaseMode/)
  assert.match(page, /doubleCheck:\s*\{/)
})

test('seller release and Proof of Income receipt are inserted in a single transaction', () => {
  const controller=read('server/controllers/Lot_Projects/Commissions/Commissions.controller.js')
  const begin=controller.indexOf('await connection.beginTransaction();', controller.indexOf('if (hasReleaseTable &&'))
  const release=controller.indexOf('UPDATE lot_project_commission_releases', begin)
  const receipt=controller.indexOf('INSERT INTO lot_project_commission_receipts',release)
  const item=controller.indexOf('INSERT INTO lot_project_commission_receipt_items', receipt)
  const commit=controller.indexOf('await connection.commit();',item)
  assert.ok(begin>0 && release>begin && receipt>release && item>receipt && commit>item, 'receipt and release must commit atomically')
  assert.match(controller, /validateReleaseReceiptDetails\(rawReceipt, actualReleaseDate, todayDateOnly\(\)\)/)
  assert.match(controller, /receiptId: Number\(receiptInsert.insertId\)/)
  assert.match(controller, /COMMISSION_RECEIPT_SCHEMA_REQUIRED/)
})

test('network company profit release records shared receipt fields atomically', () => {
  const component=read('client/src/components/Lot_Projects/CommissionComponents/NetworkCompanyProfitPanel.jsx')
  const controller=read('server/controllers/Lot_Projects/Commissions/NetworkCompanyProfit.controller.js')
  assert.match(component, /<ReleaseReceiptFields value=\{receiptDetails\}/)
  assert.match(component, /paymentReference: receiptDetails.referenceNumber.trim\(\), receiptDetails/)
  assert.match(controller, /validateReleaseReceiptDetails\(req.body\?\.receiptDetails, date, date\)/)
  assert.match(controller, /bank_name = \?, account_number = \?, receipt_date = \?, witness_name = \?/)
  assert.match(controller, /release_recorded_at = NOW\(\)/)
  assert.match(controller, /PROFIT_RECEIPT_MIGRATION_REQUIRED/)
})

test('Accredited Sellers embeds table and preserves printing, signed uploads, and access scope', () => {
  const page=read('client/src/pages/System/Accredited.jsx')
  const library=read('client/src/components/Lot_Projects/CommissionComponents/NetworkProfitAcknowledgementLibrary.jsx')
  assert.match(page, /<NetworkProfitAcknowledgementLibrary embedded/)
  assert.doesNotMatch(page, /setShowCompanyProfit\(/)
  assert.match(library, /<table className=/)
  assert.match(library, /pageGroups.map/)
  assert.match(library, /groupNetworkProfitReceiptRows/)
  assert.match(library, /<NetworkProfitProofOfIncomeModal/)
  const modal=read('client/src/components/Lot_Projects/CommissionComponents/NetworkProfitProofOfIncomeModal.jsx')
  assert.match(modal, /setPrintChoice/)
  assert.match(modal, /SignedCopyUploadModal/)
  assert.match(modal, /canViewFiles \?/)
})

test('TiDB receipt migration is non-destructive and idempotent', () => {
  const sql=read('server/migrations/20261012_release_receipt_at_payout.sql')
  for (const col of ['bank_name', 'account_number', 'receipt_date', 'witness_name']) {
    assert.match(sql,new RegExp(`ADD COLUMN IF NOT EXISTS ${col} `))
  }
  assert.doesNotMatch(sql,/\b(?:TRUNCATE|DELETE FROM|DROP TABLE)\b/i)
})

