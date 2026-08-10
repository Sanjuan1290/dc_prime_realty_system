import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('reservation form and Final Double-Check reuse the same payment and commission preview components', () => {
  const form = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx')
  const review = read('client/src/components/Shared/DoubleCheckComponents/ReservationDoubleCheck.jsx')
  const panels = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservationPreviewPanels.jsx')

  for (const component of ['ReservationPaymentPreview', 'ReservationCommissionPreview']) {
    assert.match(form, new RegExp(component))
    assert.match(review, new RegExp(component))
    assert.match(panels, new RegExp(`export const ${component}`))
  }

  assert.match(review, /key: 'listing'[\s\S]*?<ReservationPaymentPreview/)
  assert.match(review, /key: 'seller'[\s\S]*?<ReservationCommissionPreview/)
  assert.doesNotMatch(review, /label: 'Seller Role'|label: 'Seller Group'|label: 'Commission Rate'|label: 'Commission Base'/)
})

test('commission preview is carried only as review data and is stripped before the reservation API request', () => {
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx')
  const page = read('client/src/pages/Lot_Projects/ListingProfile.jsx')

  assert.match(modal, /reviewData:\s*\{[\s\S]*commissionPreview/)
  assert.match(page, /const \{ reviewData = \{\}, \.\.\.requestPayload \} = payload \|\| \{\}/)
  assert.match(page, /useFetchPost\([^\n]*reserve[^\n]*requestPayload/)
  assert.match(page, /commissionPreview:\s*reviewData\?\.commissionPreview \|\| null/)
})

test('reservation payment terms author explicit examples and preserve aligned label space', () => {
  const terms = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx')
  const shared = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveShared.jsx')

  for (const example of ['₱50,000', '10%', '5%', '6%', '20%', '18 months', '30 months', '0.15%']) {
    assert.match(terms, new RegExp(`example=["']${example.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`))
  }
  assert.match(shared, /md:min-h-7/)
  assert.match(shared, /<FieldLabel label=\{label\} required=\{required\} error=\{error\} \/>/)
})

test('penalty-free grace period defaults to zero across reservation and SOA fallback paths', () => {
  const reserveModal = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx')
  const reserveController = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js')
  const soa = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx')
  const soaController = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js')

  assert.match(reserveModal, /penaltyGraceDays:\s*'0'/)
  assert.match(reserveController, /terms\.penaltyGraceDays \?\? 0/)
  assert.match(soa, /getListingValue\(listing, \['soaPenaltyGraceDays'\], 0\)/)
  assert.match(soaController, /listing\.soa_penalty_grace_days \?\? 0/)
  assert.match(soa, /Penalty-Free Grace Period \(Days\)/)
})

