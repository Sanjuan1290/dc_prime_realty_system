import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildLatestScheduleAllocationTiming } from '../services/paymentTiming.service.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const allocation = ({ id, paymentId, scheduleId, paymentDate, dueDate }) => ({
  lot_project_payment_allocation_id: id,
  lot_project_payment_id: paymentId,
  lot_project_payment_schedule_id: scheduleId,
  lot_project_payment_date: paymentDate,
  due_date: dueDate,
})

test('nearest upcoming obligation is Paid Early while later future allocations are Advance Payment', () => {
  const timing = buildLatestScheduleAllocationTiming([
    allocation({ id: 1, paymentId: 10, scheduleId: 101, paymentDate: '2026-09-27', dueDate: '2026-09-30' }),
    allocation({ id: 2, paymentId: 10, scheduleId: 102, paymentDate: '2026-09-27', dueDate: '2026-10-30' }),
    allocation({ id: 3, paymentId: 10, scheduleId: 103, paymentDate: '2026-09-27', dueDate: '2026-11-30' }),
  ])

  assert.equal(timing.get(101)?.timing, 'early')
  assert.equal(timing.get(102)?.timing, 'advance')
  assert.equal(timing.get(103)?.timing, 'advance')
})

test('one payment can contain Paid Late, Paid Early, and Advance allocations', () => {
  const timing = buildLatestScheduleAllocationTiming([
    allocation({ id: 1, paymentId: 20, scheduleId: 201, paymentDate: '2026-09-27', dueDate: '2026-08-30' }),
    allocation({ id: 2, paymentId: 20, scheduleId: 202, paymentDate: '2026-09-27', dueDate: '2026-09-30' }),
    allocation({ id: 3, paymentId: 20, scheduleId: 203, paymentDate: '2026-09-27', dueDate: '2026-10-30' }),
  ])

  assert.equal(timing.get(201)?.timing, 'late')
  assert.equal(timing.get(202)?.timing, 'early')
  assert.equal(timing.get(203)?.timing, 'advance')
})

test('an obligation due on payment date is on time and later future rows are advance', () => {
  const timing = buildLatestScheduleAllocationTiming([
    allocation({ id: 1, paymentId: 30, scheduleId: 301, paymentDate: '2026-09-27', dueDate: '2026-09-27' }),
    allocation({ id: 2, paymentId: 30, scheduleId: 302, paymentDate: '2026-09-27', dueDate: '2026-10-30' }),
  ])

  assert.equal(timing.get(301)?.timing, 'on_time')
  assert.equal(timing.get(302)?.timing, 'advance')
})

test('an earlier advance partial is preserved when a later top-up completes the same future row', () => {
  const timing = buildLatestScheduleAllocationTiming([
    allocation({ id: 1, paymentId: 40, scheduleId: 401, paymentDate: '2026-09-27', dueDate: '2026-09-30' }),
    allocation({ id: 2, paymentId: 40, scheduleId: 402, paymentDate: '2026-09-27', dueDate: '2026-10-30' }),
    allocation({ id: 3, paymentId: 41, scheduleId: 402, paymentDate: '2026-10-15', dueDate: '2026-10-30' }),
  ])

  assert.equal(timing.get(401)?.timing, 'early')
  assert.equal(timing.get(402)?.timing, 'advance')
  assert.equal(timing.get(402)?.hadAdvanceAllocation, true)
  assert.equal(timing.get(402)?.paymentId, 41)
})

test('late completion overrides earlier advance history', () => {
  const timing = buildLatestScheduleAllocationTiming([
    allocation({ id: 1, paymentId: 50, scheduleId: 501, paymentDate: '2026-09-27', dueDate: '2026-10-30' }),
    allocation({ id: 2, paymentId: 50, scheduleId: 502, paymentDate: '2026-09-27', dueDate: '2026-11-30' }),
    allocation({ id: 3, paymentId: 51, scheduleId: 502, paymentDate: '2026-12-05', dueDate: '2026-11-30' }),
  ])

  assert.equal(timing.get(502)?.hadAdvanceAllocation, true)
  assert.equal(timing.get(502)?.timing, 'late')
})


test('Feb installment stays Advance Payment after an advance partial is topped up by a later early payment', () => {
  const timing = buildLatestScheduleAllocationTiming([
    allocation({ id: 10, paymentId: 100, scheduleId: 601, paymentDate: '2026-09-27', dueDate: '2026-10-30' }),
    allocation({ id: 11, paymentId: 100, scheduleId: 602, paymentDate: '2026-09-27', dueDate: '2026-11-30' }),
    allocation({ id: 12, paymentId: 100, scheduleId: 603, paymentDate: '2026-09-27', dueDate: '2027-02-28' }),
    allocation({ id: 13, paymentId: 101, scheduleId: 603, paymentDate: '2026-09-27', dueDate: '2027-02-28' }),
  ])

  assert.equal(timing.get(601)?.timing, 'early')
  assert.equal(timing.get(602)?.timing, 'advance')
  assert.equal(timing.get(603)?.timing, 'advance')
  assert.equal(timing.get(603)?.allocationCount, 2)
  assert.equal(timing.get(603)?.paymentId, 101)
})

test('SOA server and client expose Advance Payment / Partial Advance without changing financial schedule state', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js')
  const soa = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx')
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx')

  assert.match(shared, /buildLatestScheduleAllocationTiming/)
  assert.match(shared, /timing === 'advance'\) return 'Advance Payment'/)
  assert.match(shared, /normalized === 'partial' && timing === 'advance'\) return 'Partial Advance'/)
  assert.match(shared, /const nextStatus = isPaid \? 'Paid' : 'Partial'/)
  assert.doesNotMatch(shared, /const nextStatus = isPaid \? 'Advance'/)

  assert.match(soa, /paymentTiming === 'advance'\) return 'Advance Payment'/)
  assert.match(soa, /'partial advance'/)
  assert.match(soa, /<StatusPill status=\{row\.displayStatus \|\| row\.status\} \/>/)
  assert.match(modal, /nextContractInstallmentDate/)
  assert.match(modal, /Advance Payment: This installment is due after the next scheduled one/)
  assert.match(modal, /Future dates are not allowed/)
})

test('legacy migration still normalizes old Advance schedule_status values to Paid', () => {
  const migration = read('server/migrations/20260921_payment_timing_status.sql')

  assert.match(migration, /UPDATE lot_project_payment_schedules/)
  assert.match(migration, /SET schedule_status = 'Paid'/)
  assert.match(migration, /WHERE schedule_status = 'Advance'/)
})



test('separate October, November, December payments use full contract instead of transaction-only timing', () => {
  const schedule = [
    { lot_project_payment_schedule_id: 1, description: 'Reservation Fee', due_date: '2026-10-11', schedule_status: 'Paid' },
    { lot_project_payment_schedule_id: 2, description: '1st Downpayment', due_date: '2026-10-15', schedule_status: 'Paid' },
    { lot_project_payment_schedule_id: 3, description: '2nd Downpayment', due_date: '2026-11-15', schedule_status: 'Paid' },
    { lot_project_payment_schedule_id: 4, description: '3rd Downpayment', due_date: '2026-12-15', schedule_status: 'Paid' },
  ];
  const payments = [
    allocation({ id: 1, paymentId: 1, scheduleId: 1, paymentDate: '2026-10-11', dueDate: '2026-10-11' }),
    allocation({ id: 2, paymentId: 2, scheduleId: 2, paymentDate: '2026-10-11', dueDate: '2026-10-15' }),
    allocation({ id: 3, paymentId: 3, scheduleId: 3, paymentDate: '2026-10-11', dueDate: '2026-11-15' }),
    allocation({ id: 4, paymentId: 4, scheduleId: 4, paymentDate: '2026-10-11', dueDate: '2026-12-15' }),
  ];
  const timing = buildLatestScheduleAllocationTiming(payments, schedule);
  assert.equal(timing.get(1)?.timing, 'on_time');
  assert.equal(timing.get(2)?.timing, 'early');
  assert.equal(timing.get(3)?.timing, 'advance');
  assert.equal(timing.get(4)?.timing, 'advance');
});

test('already paid nearest installment remains the early anchor on the payment date', () => {
  const schedule = [
    { lot_project_payment_schedule_id: 1, description: '1st Downpayment', due_date: '2026-10-15', schedule_status: 'Paid' },
    { lot_project_payment_schedule_id: 2, description: '2nd Downpayment', due_date: '2026-11-15', schedule_status: 'Unpaid' },
  ];
  const timing = buildLatestScheduleAllocationTiming([
    allocation({ id: 1, paymentId: 10, scheduleId: 2, paymentDate: '2026-10-11', dueDate: '2026-11-15' }),
  ], schedule);
  assert.equal(timing.get(2)?.timing, 'advance');
});

test('when the payment date reaches the next cycle, the next obligation can be paid early', () => {
  const schedule = [
    { lot_project_payment_schedule_id: 1, description: '1st Downpayment', due_date: '2026-10-15', schedule_status: 'Paid' },
    { lot_project_payment_schedule_id: 2, description: '2nd Downpayment', due_date: '2026-11-15', schedule_status: 'Unpaid' },
    { lot_project_payment_schedule_id: 3, description: '3rd Downpayment', due_date: '2026-12-15', schedule_status: 'Unpaid' },
  ];
  const timing = buildLatestScheduleAllocationTiming([
    allocation({ id: 1, paymentId: 10, scheduleId: 2, paymentDate: '2026-10-20', dueDate: '2026-11-15' }),
    allocation({ id: 2, paymentId: 11, scheduleId: 3, paymentDate: '2026-10-20', dueDate: '2026-12-15' }),
  ], schedule);
  assert.equal(timing.get(2)?.timing, 'early');
  assert.equal(timing.get(3)?.timing, 'advance');
});

test('payment timing passes every contractual SOA row to allocation classifier', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  assert.match(shared, /buildLatestScheduleAllocationTiming\(rows, contractScheduleRows\)/);
  assert.match(shared, /selectedAccountId,\s+visibleScheduleRows/);
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx');
  assert.match(modal, /\.filter\(\(row\) => \['Downpayment', 'Monthly'\]\.includes/);
  assert.match(modal, /selectedRowDueDate === nextContractInstallmentDate/);
});
