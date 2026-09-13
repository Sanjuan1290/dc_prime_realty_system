import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('historical account encoding has no one-year lookback floor but still blocks future dates', () => {
  const paymentTerms = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx')
  const reserveModal = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx')
  const reserveController = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js')

  assert.match(paymentTerms, /There is no lookback limit/)
  assert.match(paymentTerms, /startingDateMinimum = isHistoricalEntry \? undefined : today/)
  assert.match(paymentTerms, /firstDueMinimum = isHistoricalEntry[\s\S]*paymentForm\.startingDate \|\| undefined/)
  assert.doesNotMatch(paymentTerms, /shiftIsoYears/)
  assert.doesNotMatch(reserveModal, /historicalMinimum|shiftIsoYears/)
  assert.match(reserveModal, /startingDate > today/)
  assert.match(reserveController, /startingDate > today/)
  assert.doesNotMatch(reserveController, /historicalMinimum|shiftDateYears/)
})

test('historical SOA first due date can be older than one year when it is not before the account start', () => {
  const payments = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx')
  const controller = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js')

  assert.match(payments, /There is no historical lookback limit/)
  assert.match(payments, /firstDueMinimum = form\.isHistoricalEntry[\s\S]*listingStartingDate \|\| undefined/)
  assert.match(payments, /form\.firstDueDate > today/)
  assert.doesNotMatch(payments, /historicalMinimum|shiftIsoYears/)
  assert.match(controller, /firstDueDate > today/)
  assert.match(controller, /First Due Date cannot be before the Starting Date/)
  assert.doesNotMatch(controller, /historicalMinimum|shiftDateYears/)
})
