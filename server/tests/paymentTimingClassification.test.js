import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('early payment of a scheduled due remains Paid and is displayed as Paid Early', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js')
  const soa = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx')

  assert.match(shared, /export const getSchedulePaymentTiming/)
  assert.match(shared, /if \(datePaid < dueDate\) return 'early'/)
  assert.match(shared, /if \(datePaid > dueDate\) return 'late'/)
  assert.match(shared, /if \(normalized === 'advance'\) return 'Paid Early'/)
  assert.match(shared, /row\.status = 'Paid';/)
  assert.match(shared, /const nextStatus = isPaid \? 'Paid' : 'Partial';/)
  assert.doesNotMatch(shared, /paidBeforeDue \? 'Advance' : 'Paid'/)

  assert.match(soa, /if \(datePaid < dueDate\) return 'Paid Early'/)
  assert.match(soa, /if \(datePaid > dueDate\) return 'Paid Late'/)
  assert.match(soa, /<StatusPill status=\{row\.displayStatus \|\| row\.status\} \/>/)
})

test('Advance Payment remains an explicit payment type, not an early-payment timing label', () => {
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx')
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js')

  assert.match(modal, /'Advance Payment'/)
  assert.match(modal, /will be shown as Paid Early, not Advance Payment/)
  assert.match(modal, /Use Advance Payment only for an extra payment intentionally applied toward future monthly obligations/)
  assert.match(shared, /advance_payment: 'Advance Payment'/)
  assert.match(shared, /\['monthly_amortization', 'advance_payment'\]/)
})

test('migration converts legacy Advance schedule statuses to Paid without changing payment types', () => {
  const migration = read('server/migrations/20260921_payment_timing_status.sql')

  assert.match(migration, /UPDATE lot_project_payment_schedules/)
  assert.match(migration, /SET schedule_status = 'Paid'/)
  assert.match(migration, /WHERE schedule_status = 'Advance'/)
  assert.doesNotMatch(migration, /UPDATE lot_project_payments/)
})

