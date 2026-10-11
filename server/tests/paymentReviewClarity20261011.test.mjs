import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const load = (path) => readFileSync(resolve(root,path),'utf8')
const controller = load('server/controllers/System/workflow.controller.js')
const router = load('server/routers/System/workflow.routers.js')
const page = load('client/src/pages/System/ReviewCenter.jsx')
const proofComponent = load('client/src/components/Shared/PaymentProofReviewFiles.jsx')

test('payment proof reviews read present-day scan states from proof table rather than frozen snapshot', () => {
  assert.match(controller,/liveReviewProofs\(db, displayReview\)/)
  assert.match(controller,/SELECT lot_project_payment_proof_id, lot_project_payment_id, file_name,[\s\S]*malware_scan_status/)
  assert.match(controller,/malwareScanStatus: status/)
})
test('proofs are limited to IDs explicitly present in review snapshot', () => {
  assert.match(controller,/reviewProofIds\(review\)/)
  assert.match(controller,/lot_project_payment_proof_id IN \(\$\{proofIds\.map/)
  assert.match(controller,/reviewProofIds\(review\)\.includes\(proofId\)/)
})
test('preview route enforces workflow role and review-view permission', () => {
  assert.match(router,/router\.get\('\/reviews\/:id\/proofs\/:proofId\/content',requireReviewCenterRole,requirePermission\(PERMISSIONS\.WORKFLOW_REVIEW_CENTER_VIEW\)/)
  assert.match(controller,/canActorOpenReview\(db, req\.authUser, review\)/)
  assert.match(controller,/canActorViewReview\(db, req\.authUser, review\)/)
})
test('preview binds proof to the review payment instead of trusting a request payment ID', () => {
  assert.match(controller,/WHERE lot_project_payment_proof_id = \? AND lot_project_payment_id = \? LIMIT 1/)
  assert.match(controller,/\[proofId, Number\(review\.entity_id\)\]/)
})
test('only server-confirmed approved scans may show previews', () => {
  assert.match(controller,/String\(proof\.malware_scan_status \|\| ''\)\.toLowerCase\(\) !== 'approved'/)
  assert.match(controller,/previewAvailable: status === 'approved' && row\?\.proof_status === 'active'/)
})
test('no public Cloudinary URL or public ID is sent to Review Center browser', () => {
  const liveMapping = controller.slice(controller.indexOf('const liveReviewProofs'), controller.indexOf('// Use the review\'s own visibility'))
  assert.doesNotMatch(liveMapping,/cloudinary_public_id|cloudinary\.com|asset_id/)
})
test('UI hides internal payment/schedule identifiers only for payment create', () => {
  assert.match(page,/reviewActionKey === 'payment\.create' && \['paymentId', 'scheduleId', 'listingId'\]/)
  assert.match(page,/isHiddenField=\{reviewSnapshotHidden\}/)
  assert.match(page,/referenceId: 'Payment Reference'/)
})
test('frozen malware status is hidden from payment proof snapshot comparison', () => {
  assert.match(page,/reviewActionKey === 'payment_proof\.verify' && \[[^\]]*'malwareScanStatus'/)
})
test('Review Center polling only runs for pending payment proofs', () => {
  assert.match(page,/refetchInterval: \(result\) => result\.state\.data\?\.data\?\.proofFiles\?\.some\(\(file\) => file\.malwareScanStatus === 'pending'\) \? 5000 : false/)
})
test('image previews are fetched from authenticated review-scoped content only', () => {
  assert.match(proofComponent,/fetchProtectedObjectUrl\(contentPath\)/)
  assert.match(proofComponent,/\/workflow\/reviews\/\$\{encodeURIComponent\(reviewId\)\}\/proofs\/\$\{encodeURIComponent\(file\.proofId\)\}\/content/)
  assert.doesNotMatch(proofComponent,/cloudinary\.com/)
  assert.match(proofComponent,/revokeProtectedObjectUrl/)
})
test('pending status stays pending and never grants preview', () => {
  assert.match(proofComponent,/Awaiting security scan result/)
  assert.match(proofComponent,/Still waiting for the Cloudinary scan result/)
  assert.match(proofComponent,/!file\.previewAvailable/)
})
test('other scan outcomes distinguish scan failure rejection and not_scanned', () => {
  assert.match(proofComponent,/Security scan passed/)
  assert.match(proofComponent,/Security scan blocked this file/)
  assert.match(proofComponent,/Security scan failed/)
  assert.match(proofComponent,/Not security scanned/)
})

test('reservation payment types are shown in customer-facing language', async () => {
  const { formatSnapshotValue } = await import('../../client/src/utils/reviewSnapshotFormat.js')
  assert.equal(formatSnapshotValue('paymentType', 'reservation'), 'Reservation Payment')
  assert.equal(formatSnapshotValue('referenceId', 'CASH-20261011-LA1805-P0001'), 'CASH-20261011-LA1805-P0001')
})
