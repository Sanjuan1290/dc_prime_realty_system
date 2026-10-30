import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMissingProofOfIncomeReview } from '../../../CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/missingProofOfIncomeReview.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')
const modal = read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx')
const reviewComponent = read('CLIENT/SYSTEM/src/components/Shared/DoubleCheckComponents/ProofOfIncomeDoubleCheck.jsx')
const valid = {
  commissionGroup: { project: 'Bailen Project', unit: 'LA-1805', client: 'Robert Renby Moreno San Juan' },
  commission: { seller: 'Rowena Moreno um', role: 'Unit Manager' },
  missingReceiptChoice: {
    commissionId: 30001, releaseId: 30099, stage: '1st Release', amount: 2496,
    releasePercent: 20, triggerPercent: 20, actualReleaseDate: '2026-10-11', sellerId: 60002,
  },
  receiptDetails: {
    bankName: 'BPI', accountNumber: '123456', receiptDate: '2026-10-12',
    referenceNumber: '342342', witnessName: 'Kirsten',
  },
}

test('historical missing receipt review contains seller, project, buyer, amount and original paid milestone', () => {
  const data = buildMissingProofOfIncomeReview(valid)
  assert.deepEqual(data.seller, { name: valid.commission.seller })
  assert.deepEqual(data.property, {
    project: 'Bailen Project', unit: 'LA-1805', buyer: 'Robert Renby Moreno San Juan',
  })
  assert.equal(data.totalAmount, 2496)
  assert.deepEqual(data.selectedReleases, [{
    releaseId: 30099, stage: '1st Release', releasePercent: 20,
    triggerPercent: 20, amount: 2496, releaseDate: '2026-10-11', status: 'Released',
  }])
  assert.deepEqual(data.receiptDetails, { ...valid.receiptDetails, paymentMethod: 'bank_transfer' })
  assert.equal(data.action, 'create-existing-release-receipt')
})

test('receipt review shows the same five receipt field names as Accredited Sellers', () => {
  for (const field of ['bankName', 'accountNumber', 'receiptDate', 'referenceNumber', 'witnessName']) {
    assert.match(reviewComponent, new RegExp(`pick\\(receipt, '${field}'\\)`))
  }
  assert.match(reviewComponent, /Array\.isArray\(data\.selectedReleases\)/)
  assert.match(reviewComponent, /data\.totalAmount/)
})

test('incomplete financial identity or paid release blocks review rather than showing Not provided', () => {
  assert.throws(() => buildMissingProofOfIncomeReview({ ...valid, commissionGroup: { ...valid.commissionGroup, unit: '-' } }), /incomplete/)
  assert.throws(() => buildMissingProofOfIncomeReview({ ...valid, missingReceiptChoice: { ...valid.missingReceiptChoice, releaseId: 0 } }), /incomplete/)
  assert.throws(() => buildMissingProofOfIncomeReview({ ...valid, missingReceiptChoice: { ...valid.missingReceiptChoice, sellerId: 0 } }), /incomplete/)
  assert.throws(() => buildMissingProofOfIncomeReview({ ...valid, missingReceiptChoice: { ...valid.missingReceiptChoice, amount: 0 } }), /incomplete/)
  assert.throws(() => buildMissingProofOfIncomeReview({ ...valid, receiptDetails: { ...valid.receiptDetails, witnessName: '' } }), /incomplete/)
})

test('Commission Details review uses the shared review-data builder and links existing payment without new release', () => {
  assert.match(modal, /buildMissingProofOfIncomeReview\(\{/)
  assert.match(modal, /data: reviewData/)
  assert.match(modal, /releasePercent: stage\.releasePercent/)
  assert.match(modal, /triggerPercent: stage\.triggerPercent/)
  assert.match(modal, /confirmLabel: 'Confirm & Link Receipt'/)
  assert.match(modal, /releaseIds: \[missingReceiptChoice\.releaseId\]/)
  assert.doesNotMatch(modal.slice(modal.indexOf('const saveMissingReceipt'),modal.indexOf('const changeBeneficiary')), /action: 'release_stage'/)
})




test('Cash legacy receipt review previews generated reference, not a missing voucher', () => {
  const data = buildMissingProofOfIncomeReview({
    ...valid,
    paymentMethod: 'cash',
    receiptDetails: {receiptDate:'2026-10-12',witnessName:'Kirsten',bankName:'',accountNumber:'',referenceNumber:''},
  });
  assert.equal(data.receiptDetails.bankName,'Not applicable (Cash)');
  assert.equal(data.receiptDetails.referenceNumber,'Generated automatically on save');
  assert.equal(data.receiptDetails.paymentMethod,'cash');
});

