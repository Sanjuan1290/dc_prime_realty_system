import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('reservation backdating has no lookback floor, blocks future starting dates, and keeps imported-account status separate', () => {
  const paymentTerms = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx')
  const reserveModal = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx')
  const reserveController = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js')

  assert.match(paymentTerms, /Import an existing client account/)
  assert.match(paymentTerms, /const startingDateMaximum = today/)
  assert.match(paymentTerms, /const firstDueMinimum = paymentForm\.startingDate \|\| undefined/)
  assert.match(paymentTerms, /Past dates are allowed for delayed encoding or system downtime; future dates are not allowed/)
  assert.match(paymentTerms, /Backdate Reason/)
  assert.match(paymentTerms, /This reason is saved in the reservation Audit Log/)
  assert.doesNotMatch(paymentTerms, /startingDateMinimum|historicalMinimum|shiftIsoYears/)

  assert.match(reserveModal, /startingDate > today/)
  assert.match(reserveModal, /startingDate < today && !backdateReason/)
  assert.match(reserveModal, /firstDueDate < startingDate/)
  assert.doesNotMatch(reserveModal, /Starting Date must be today or a future date/)
  assert.doesNotMatch(reserveModal, /historicalMinimum|shiftIsoYears/)

  assert.match(reserveController, /startingDate > today/)
  assert.match(reserveController, /startingDate < today && !backdateReason/)
  assert.match(reserveController, /firstDueDate < startingDate/)
  assert.match(reserveController, /backdateReason: backdateReason \|\| null/)
  assert.doesNotMatch(reserveController, /Starting Date must be today or a future date/)
  assert.doesNotMatch(reserveController, /historicalMinimum|shiftDateYears/)
})

test('SOA first due date may be past or future when it is not before the saved account start', () => {
  const payments = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx')
  const controller = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js')

  assert.match(payments, /Imported Existing Account/)
  assert.match(payments, /const firstDueMinimum = listingStartingDate \|\| undefined/)
  assert.match(payments, /Must be on or after the saved Starting Date\. Past or future dates are allowed\./)
  assert.doesNotMatch(payments, /firstDueMaximum|historicalMinimum|shiftIsoYears/)
  assert.doesNotMatch(payments, /Historical First Due Date cannot be after today/)
  assert.doesNotMatch(payments, /First Due Date must be today or a future date/)

  assert.match(controller, /firstDueDate < startingDate/)
  assert.match(controller, /First Due Date cannot be before the Starting Date/)
  assert.doesNotMatch(controller, /Historical First Due Date cannot be after today/)
  assert.doesNotMatch(controller, /First Due Date must be today or a future date/)
  assert.doesNotMatch(controller, /historicalMinimum|shiftDateYears/)
})

