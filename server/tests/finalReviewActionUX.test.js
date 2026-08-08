import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('buyer profile opens final review instead of claiming it saves immediately', () => {
  const source = read('client/src/components/Lot_Projects/ListingProfileComponents/ClientProfile/EditClientProfileModal.jsx')
  assert.match(source, /Proceed to Final Review/)
  assert.match(source, /Preparing buyer profile for the final double-check/)
  assert.doesNotMatch(source, />Save Buyer Profile</)
  assert.doesNotMatch(source, /Saving buyer profile to database/)
})

test('document and payment proof reviews expose local file preview without uploading first', () => {
  const provider = read('client/src/components/Shared/MutationReviewProvider.jsx')
  const documents = read('client/src/components/Lot_Projects/ListingProfileComponents/Documents/UploadDocumentModal.jsx')
  const proofs = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/PaymentProofModal.jsx')
  assert.match(provider, /Preview File/)
  assert.match(provider, /previewUrl/)
  assert.match(documents, /URL\.createObjectURL/)
  assert.match(proofs, /URL\.createObjectURL/)
  assert.match(documents, /preview every selected file/)
  assert.match(proofs, /preview every selected proof file/)
})

test('commission release review is curated to beneficiary and selected release only', () => {
  const source = read('client/src/pages/Lot_Projects/Commission.jsx')
  assert.match(source, /commissionBeneficiary/)
  assert.match(source, /selectedRelease/)
  assert.match(source, /remainingBeforeRelease/)
  assert.match(source, /grossReleaseAmount/)
  assert.match(source, /netReleaseAmount/)
  assert.doesNotMatch(source, /seller:\s*commissionForReview/)
  assert.doesNotMatch(source, /selectedMilestone:\s*releaseForReview/)
  assert.doesNotMatch(source, /action:\s*payload/)
})

test('commission release does not claim it is saving before final confirmation and treats review cancellation as informational', () => {
  const source = read('client/src/pages/Lot_Projects/Commission.jsx')
  assert.match(source, /Preparing commission release review\.\.\./)
  assert.doesNotMatch(source, /Saving commission release\.\.\./)
  assert.match(source, /REVIEW_CANCELLED/)
  assert.match(source, /Final review closed/)
  assert.match(source, /Nothing was released\./)
})

test('commission hold and unhold use compact confirmation and skip the global review wizard', () => {
  const page = read('client/src/pages/Lot_Projects/Commission.jsx')
  const modal = read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx')
  assert.match(page, /\['hold_stage', 'unhold_stage'\]\.includes\(action\)/)
  assert.match(page, /skipReview:\s*true/)
  assert.match(modal, /hold_stage: 'Hold Stage'/)
  assert.match(modal, /unhold_stage: 'Unhold Stage'/)
  assert.match(modal, /release_stage: 'Proceed to Final Review'/)
})

test('future cash references clearly mark the payment database id', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js')
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx')
  assert.match(shared, /-P\$\{String\(numericPaymentId\)\.padStart\(4, '0'\)\}/)
  assert.match(modal, /CASH-YYYYMMDD-UNIT-P60001/)
})

