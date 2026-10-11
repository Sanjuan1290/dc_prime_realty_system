import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const modal = readFileSync(new URL('../../client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/PaymentProofModal.jsx', import.meta.url), 'utf8')
const controller = readFileSync(new URL('../controllers/Lot_Projects/ListingProfile/PaymentProofs.controller.js', import.meta.url), 'utf8')

test('payment proof status list polls while a saved proof is pending', () => {
  assert.match(modal, /SCAN_STATUS_POLL_MS = 4_000/)
  assert.match(modal, /hasPendingProofScans = proofs\.some\(\(proof\) => getMalwareScanStatus\(proof\) === 'pending'\)/)
  assert.match(modal, /if \(!paymentId \|\| !hasPendingProofScans \|\| isUploading \|\| deletingProofId\) return undefined/)
  assert.match(modal, /window\.setInterval\(\(\) => \{ void refreshScanStatuses\(\) \}, SCAN_STATUS_POLL_MS\)/)
  assert.match(modal, /const result = await useFetch\(basePath\)/)
  assert.match(modal, /setProofs\(nextProofs\)/)
})

test('polling is non-overlapping, stops cleanly, and refreshes when browser tab becomes visible', () => {
  assert.match(modal, /if \(!active \|\| inFlight \|\| document\.visibilityState === 'hidden'\) return/)
  assert.match(modal, /if \(!active \|\| !Array\.isArray\(result\?\.data\?\.proofs\)\) return/)
  assert.match(modal, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/)
  assert.match(modal, /active = false[\s\S]*window\.clearInterval\(intervalId\)[\s\S]*document\.removeEventListener\('visibilitychange', handleVisibilityChange\)/)
})

test('transient polling failures keep existing statuses and never mark a pending scan as approved', () => {
  assert.match(modal, /catch \{\s*\/\/ A transient status-check failure/)
  assert.match(modal, /getMalwareScanStatus\(proof\) === 'pending' \? <FiLoader/)
  assert.match(modal, /\{malwareScanLabel\(proof\)\}/)
  assert.match(modal, /if \(!canOpenMalwareScannedFile\(proof\)\)/)
  assert.doesNotMatch(modal, /setProofs\([^\n]*malwareScanStatus:\s*'approved'/)
})

test('the existing protected payment-proofs endpoint sends backend scan status', () => {
  assert.match(controller, /export const getLotProjectPaymentProofs/)
  assert.match(controller, /malwareScanStatus:\s*clean\(row\.malware_scan_status/)
  assert.match(controller, /proofs:\s*rows\.map\(\(row\) => mapProof\(req, row\)\)/)
})
