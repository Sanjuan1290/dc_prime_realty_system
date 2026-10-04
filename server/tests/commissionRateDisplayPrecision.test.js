import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('commission rate UI displays four decimal places in reservation previews and saved distributions', () => {
  const preview = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservationPreviewPanels.jsx')
  const picker = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx')
  const distribution = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/CommissionDistribution.jsx')

  assert.match(preview, /poolRate \|\| 0\)\.toFixed\(4\)/)
  assert.match(preview, /allocatedRate \|\| 0\)\.toFixed\(4\)/)
  assert.match(preview, /unallocatedRate \|\| 0\)\.toFixed\(4\)/)
  assert.match(preview, /row\.rate \|\| 0\)\.toFixed\(4\)/)
  assert.doesNotMatch(preview, /row\.rate \|\| 0\)\.toFixed\(2\)/)

  assert.match(picker, /directRate \|\| selectedAgent\.rateValue \|\| 0\)\.toFixed\(4\)/)
  assert.match(picker, /directRate \|\| agent\.rateValue \|\| 0\)\.toFixed\(4\)/)

  assert.match(distribution, /summary\.allocatedRate\.toFixed\(4\)/)
  assert.match(distribution, /row\.rate \|\| 0\)\.toFixed\(4\)/)
  assert.doesNotMatch(distribution, /row\.rate \|\| 0\)\.toFixed\(2\)/)
})

test('commission details, seller income and double-check displays preserve four-decimal rates', () => {
  const releaseDetails = read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx')
  const accredited = read('client/src/pages/System/Accredited.jsx')
  const doubleCheck = read('client/src/components/Shared/DoubleCheckComponents/CommissionReleaseDoubleCheck.jsx')

  assert.match(releaseDetails, /Number\(commission\.rate \|\| 0\)\.toFixed\(4\)/)
  assert.match(accredited, /Number\(entry\.commissionRate \|\| 0\)\.toFixed\(4\)/)
  assert.match(accredited, /Number\(group\.commissionRate \|\| 0\)\.toFixed\(4\)/)
  assert.match(doubleCheck, /const commissionPercent = [\s\S]*?toFixed\(4\)/)
  assert.match(doubleCheck, /label: 'Commission Rate'[\s\S]*?formatter: commissionPercent/)
})

test('server-provided commission rate labels and adjustment messages use four-decimal precision', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js')
  const listingProfile = read('server/controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js')
  const adjustment = read('server/services/unitCommissionAdjustment.service.js')

  assert.match(shared, /commission_rate[^\n]*toFixed\(4\)/)
  assert.match(shared, /rateValue\.toFixed\(4\)/)
  assert.match(listingProfile, /Allocated Rate:[^\n]*toFixed\(4\)/)
  assert.match(adjustment, /normalizedGroupRate\.toFixed\(4\)/)
  assert.match(adjustment, /allocatedRate\.toFixed\(4\)/)
})
