import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseBusinessTimestamp, formatPhilippineDateTime,
  formatPhilippineCalendarDate, formatDateOnly, formatDateTime,
} from '../../client/src/utils/formatDateTime.js'
import { displayBusinessInstant } from '../utils/businessDateTime.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const cases = [
  ['2026-10-11 04:53:00', '2026-10-11T04:53:00.000Z'],
  ['2026-10-11T04:53:00', '2026-10-11T04:53:00.000Z'],
  ['2026-10-11T12:53:00+08:00', '2026-10-11T04:53:00.000Z'],
  ['2026-10-11T04:53:00Z', '2026-10-11T04:53:00.000Z'],
  ['2026-12-31 18:00:00', '2026-12-31T18:00:00.000Z'],
  ['2026-02-28T23:59:59-05:00', '2026-03-01T04:59:59.000Z'],
  ['2026-10-11 04:53:00.500', '2026-10-11T04:53:00.500Z'],
]
for (const [input, expected] of cases) {
  test(`UTC and offset timestamp parser: ${input}`, () => {
    assert.equal(parseBusinessTimestamp(input)?.toISOString(), expected)
  })
}
for (const input of ['2026-10-11', 'not a date', '', null, '2026-13-35 00:00:00']) {
  test(`invalid instant is not silently treated as a local datetime: ${input}`, () => {
    assert.equal(parseBusinessTimestamp(input), null)
  })
}
test('supports explicitly configured Philippine DATETIME source without double shifting explicit offsets', () => {
  assert.equal(parseBusinessTimestamp('2026-10-11 12:53:00', { naiveTimeZone: 'Asia/Manila' }).toISOString(), '2026-10-11T04:53:00.000Z')
  assert.equal(parseBusinessTimestamp('2026-10-11T12:53:00+08:00', { naiveTimeZone: 'Asia/Manila' }).toISOString(), '2026-10-11T04:53:00.000Z')
})
test('system keeps UTC-sourced review event in PHT', () => {
  assert.match(formatPhilippineDateTime('2026-10-11 04:53:00', { timeZoneLabel: true }), /Oct 11, 2026, 12:53 PM PHT/)
  assert.equal(formatDateTime('2026-10-11 04:53:00'), '2026-10-11 12:53')
  assert.match(displayBusinessInstant('2026-10-11 04:53:00'), /Oct 11, 2026, 12:53 PM/)
})
test('contract DATE remains fixed, including midnight and leap day', () => {
  for (const date of ['2026-01-01', '2026-10-11', '2026-12-31', '2028-02-29']) {
    assert.equal(formatPhilippineCalendarDate(date), date)
    assert.equal(formatDateOnly(date), date)
    assert.equal(formatDateTime(date), date)
  }
  assert.equal(formatPhilippineCalendarDate('2026-10-11', { style: 'medium' }), 'Oct 11, 2026')
})
test('UTC to PHT changes calendar day at midnight and year-end', () => {
  assert.equal(formatDateTime('2026-12-31 18:00:00'), '2027-01-01 02:00')
  assert.equal(formatDateTime('2026-10-11 23:59:00'), '2026-10-12 07:59')
})

for (const tz of ['UTC','Asia/Manila','America/Los_Angeles','Pacific/Auckland']) {
  test(`browser timezone ${tz} cannot change review times or contractual DATE values`, () => {
    const script = `import {formatDateTime,formatPhilippineCalendarDate,formatPhilippineDateTime} from './client/src/utils/formatDateTime.js';\nconsole.log(JSON.stringify([formatDateTime('2026-10-11 04:53:00'),formatPhilippineCalendarDate('2026-10-11'),formatPhilippineDateTime('2026-10-11T04:53:00Z',{timeZoneLabel:true})]));`
    const stdout = execFileSync(process.execPath, ['--input-type=module','-e',script], { cwd:root,env:{ ...process.env,TZ:tz },encoding:'utf8' }).trim()
    assert.deepEqual(JSON.parse(stdout), ['2026-10-11 12:53','2026-10-11','Oct 11, 2026, 12:53 PM PHT'])
  })
}
const imports = [
  'client/src/pages/System/ReviewCenter.jsx',
  'client/src/pages/Public/BuyerForm.jsx',
  'client/src/components/Lot_Projects/ListingProfileComponents/BuyerForm/BuyerFormLinkModal.jsx',
  'client/src/components/Lot_Projects/ListingProfileComponents/BuyerForm/BuyerFormStatusBanner.jsx',
  'client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/PaymentProofModal.jsx',
  'client/src/components/Shared/SignedCopyUploadModal.jsx',
  'client/src/components/Lot_Projects/ListingComponents/ListingImportModal/ListingImportHistoryModal.jsx',
  'client/src/components/System/sellerGroupComponents/NetworkMemberImportHistoryModal.jsx',
  'client/src/pages/System/DataIntegrity.jsx',
  'client/src/components/System/employeeSalaryComponents/PayrollSettingsModal.jsx',
  'client/src/pages/System/ReportsPrintPage.jsx',
  'client/src/utils/reviewSnapshotFormat.js',
]
for (const file of imports) {
  test(`${file}: uses shared business timestamp formatter`, () => {
    assert.match(read(file), /formatPhilippineDateTime/)
  })
}
for (const file of [
  'client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx',
  'client/src/components/Lot_Projects/ListingProfileComponents/Printouts/PrintPreviewModal.jsx',
  'client/src/pages/System/ReportsPrintPage.jsx',
]) {
  test(`${file}: uses a calendar-safe DATE formatter`, () => {
    assert.match(read(file), /formatPhilippineCalendarDate/)
  })
}
test('buyer form expiry is verified using TiDB session clock, never Render local timezone', () => {
  const s = read('server/controllers/Lot_Projects/BuyerForms/BuyerForms.controller.js')
  assert.match(s, /\(link\.expires_at <= NOW\(\)\) AS is_expired/)
  assert.match(s, /Number\(record\.is_expired\) === 1/)
  assert.doesNotMatch(s, /new Date\(record\.expires_at\)/)
})
test('protected change expiry is generated and compared entirely in the same database clock', () => {
  const s = read('server/services/protectedChange.service.js')
  assert.match(s, /DATE_ADD\(NOW\(\), INTERVAL \? HOUR\)/)
  assert.equal((s.match(/SELECT \(expires_at <= NOW\(\)\) AS expired/g) || []).length,2)
  assert.doesNotMatch(s,/new Date\(row\.expires_at\)/)
})
test('source timezone remains explicit, configurable, and does not mutate any saved DATE records', () => {
  assert.match(read('client/src/utils/formatDateTime.js'),/VITE_DB_DATETIME_SOURCE_TIME_ZONE/)
  assert.match(read('server/utils/businessDateTime.js'),/TIDB_DATETIME_SOURCE_TIME_ZONE/)
  assert.doesNotMatch(read('server/db/connect.js'),/SET time_zone/)
})

