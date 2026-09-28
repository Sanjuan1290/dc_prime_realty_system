import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { amountToPhilippineWords, buildFundReleaseReceipt } from '../services/payrollReceipt.service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const finalizedBenchmarkPayroll = () => ({
  employee_payroll_id: 11,
  payroll_status: 'finalized',
  finalized_at: '2026-09-22 09:00:00',
  witness_name: null,
  finalized_snapshot: {
    period: { label: 'September 1–15, 2026', start: '2026-09-01', end: '2026-09-15', type: 'first_half' },
    employee: {
      name: 'ROBERT RENBY C. SAN JUAN',
      position: 'Junior IT & Systems Developer',
      department: 'Sales',
      employment_status: 'probationary',
    },
    compensation: { monthly_basic: 15000, half_month_basic: 7500, hourly_rate: 49.32 },
    attendance: {
      expected_regular_minutes: 4620,
      regular_attended_minutes: 3543,
      pto_minutes: 0,
      regular_holiday_minutes: 0,
      special_holiday_minutes: 0,
      tardiness_absence_minutes: 1255,
      overtime_minutes: 0,
      rest_day_overtime_minutes: 0,
      night_differential_minutes: 0,
    },
    earnings: { overtime_pay: 0, rest_day_overtime_pay: 0, regular_holiday_pay: 0, special_holiday_pay: 0, night_differential_pay: 0 },
    allowances: { rice_allowance: 0, transportation_allowance: 0, attendance_bonus: 0 },
    adjustments: { manual_additions_total: 0, manual_deductions_total: 0 },
    deductions: { attendance_deduction: 1031.61 },
    net_fund_release: 6468.39,
  },
});

test('amount in words reproduces the supplied receipt benchmark', () => {
  assert.equal(
    amountToPhilippineWords(6468.39),
    'SIX THOUSAND FOUR HUNDRED SIXTY EIGHT PESOS AND THIRTY NINE CENTAVOS ONLY'
  );
});

test('finalized receipt reproduces benchmark values from the immutable snapshot', () => {
  const payroll = finalizedBenchmarkPayroll();
  payroll.half_month_basic = 999999;
  payroll.net_fund_release = 1;
  const receipt = buildFundReleaseReceipt(payroll, { today: '2026-09-28' });
  assert.equal(receipt.official, true);
  assert.equal(receipt.source, 'finalized_snapshot');
  assert.equal(receipt.receipt_date, '2026-09-22');
  assert.equal(receipt.half_month_basic, 7500);
  assert.equal(receipt.hourly_rate, 49.32);
  assert.equal(receipt.total_regular_hours, 77);
  assert.equal(receipt.total_regular_hours_attended, 59.05);
  assert.equal(receipt.tardiness_absence_minutes, 1255);
  assert.equal(receipt.total_deduction, 1031.61);
  assert.equal(receipt.subtotal_after_attendance, 6468.39);
  assert.equal(receipt.total, 6468.39);
});

test('Draft receipt is preview-only and official output is blocked without a finalized snapshot', () => {
  const draft = buildFundReleaseReceipt({
    employee_payroll_id: 12,
    payroll_status: 'draft',
    employee_name_snapshot: 'Draft Employee',
    half_month_basic: 5000,
    net_fund_release: 5000,
  }, { today: '2026-09-28' });
  assert.equal(draft.official, false);
  assert.equal(draft.preview_only, true);
  assert.equal(draft.source, 'draft_calculation');

  const legacyFinalized = buildFundReleaseReceipt({
    employee_payroll_id: 13,
    payroll_status: 'finalized',
    half_month_basic: 5000,
    net_fund_release: 5000,
  }, { today: '2026-09-28' });
  assert.equal(legacyFinalized.official, false);
  assert.equal(legacyFinalized.finalized_snapshot_missing, true);
});

test('Batch 5 exposes receipt preview endpoint and separate print/export permissions', () => {
  const router = read('server/routers/System/employeePayroll.routers.js');
  const serverPermissions = read('server/config/permissions.js');
  const clientPermissions = read('client/src/config/permissions.js');
  const accessControl = read('server/controllers/System/accessControl.controller.js');
  assert.match(router, /drafts\/:employeePayrollId\/receipt/);
  assert.match(serverPermissions, /PAYROLL_RECEIPT_PRINT: 'employee_salary\.receipt\.print'/);
  assert.match(serverPermissions, /PAYROLL_RECEIPT_EXPORT: 'employee_salary\.receipt\.export'/);
  assert.match(clientPermissions, /PAYROLL_RECEIPT_PRINT/);
  assert.match(clientPermissions, /PAYROLL_RECEIPT_EXPORT/);
  assert.match(accessControl, /Finalize Payroll/);
  assert.match(accessControl, /Print Payroll Receipt/);
  assert.match(accessControl, /Export Payroll Receipt/);
});

test('one canonical receipt component powers preview, print and PDF export', () => {
  const receipt = read('client/src/components/System/employeeSalaryComponents/FundReleaseReceipt.jsx');
  const modal = read('client/src/components/System/employeeSalaryComponents/FundReleaseReceiptModal.jsx');
  const salary = read('client/src/pages/System/EmployeeSalary.jsx');
  assert.match(receipt, /Acknowledgement Receipt for Fund Release/);
  assert.match(receipt, /Preview Only — Draft Payroll — Not Official/);
  assert.match(receipt, /Total Amount:/);
  assert.match(receipt, /Received by:/);
  assert.match(receipt, /Witness:/);
  assert.match(modal, /<FundReleaseReceipt receipt=\{receipt\}/);
  assert.match(modal, /openElementInPdfPrintWindow/);
  assert.match(modal, /downloadElementAsPdf/);
  assert.match(modal, /Export PDF/);
  assert.match(salary, /Preview Receipt/);
  assert.doesNotMatch(salary, /Preview Receipt is implemented in Batch 5/);
});
