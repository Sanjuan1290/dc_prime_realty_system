import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { evaluateAttendanceBonus, calculateDraftPayrollMoney } from '../services/payrollCalculation.service.js';
import { normalizePayrollSettingsSnapshot, validatePayrollSettingsPayload, payrollSettingsEqual } from '../services/payrollSettings.service.js';
import { sameEffectiveCompensation } from '../services/payrollFinalization.service.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = (path) => readFileSync(resolve(root, path), 'utf8');
const complete = (override = {}) => ({
  rule: 'perfect_attendance_per_period', amount: 500, attendanceThrough: '2026-10-15',
  periodEnd: '2026-10-15', attendance: { scheduledDays: 8, tardinessAbsenceMinutes: 0 },
  rows: [{timeIn:'09:00',timeOut:'20:00'}], ...override,
});

test('Attendance Bonus remains unpaid by default and no previous salary changes', () => {
  assert.equal(normalizePayrollSettingsSnapshot({}).attendance_bonus_rule, 'not_configured');
  assert.equal(evaluateAttendanceBonus(complete({rule:'not_configured'})).eligible, false);
  assert.equal(evaluateAttendanceBonus(complete({rule:'disabled'})).eligible, false);
  assert.equal(calculateDraftPayrollMoney({ monthlyBasicSalary:15000,regularWorkingMinutes:600,tardinessAbsenceMinutes:0,periodType:'first_half',attendanceBonusAmount:500 }).attendanceBonus,0);
});
test('Payroll Settings accept only explicit company policy choices and keep them in revision comparison', () => {
  assert.equal(validatePayrollSettingsPayload({attendance_bonus_rule:'perfect_attendance_per_period'}).attendance_bonus_rule,'perfect_attendance_per_period');
  assert.throws(()=>validatePayrollSettingsPayload({attendance_bonus_rule:'free_bonus'}),/Attendance Bonus rule/);
  assert.equal(payrollSettingsEqual({attendance_bonus_rule:'not_configured'},{attendance_bonus_rule:'perfect_attendance_per_period'}),false);
});
test('bonus requires completed period, recorded workdays, no lateness or missing Time Out', () => {
  assert.equal(evaluateAttendanceBonus(complete()).eligible,true);
  assert.equal(evaluateAttendanceBonus(complete({attendanceThrough:'2026-10-14'})).eligible,false);
  assert.equal(evaluateAttendanceBonus(complete({attendance:{scheduledDays:8,tardinessAbsenceMinutes:15}})).eligible,false);
  assert.equal(evaluateAttendanceBonus(complete({attendance:{scheduledDays:0,tardinessAbsenceMinutes:0}})).eligible,false);
  assert.equal(evaluateAttendanceBonus(complete({rows:[]})).eligible,false);
  assert.equal(evaluateAttendanceBonus(complete({rows:[{timeIn:'09:00',timeOut:null}]})).eligible,false);
});
test('approved rule pays the configured bonus once per pay period, proration affects new hires', () => {
  const args = { monthlyBasicSalary:15000,regularWorkingMinutes:600,tardinessAbsenceMinutes:0, periodType:'first_half', attendanceBonusAmount:500,attendanceBonusEligible:true };
  const full=calculateDraftPayrollMoney(args);
  assert.equal(full.attendanceBonus,500);
  assert.equal(full.netFundRelease,8000);
  const firstHire=calculateDraftPayrollMoney({...args,prorationFraction:0.5});
  assert.equal(firstHire.attendanceBonus,250);
  assert.equal(firstHire.netFundRelease,4000);
  assert.equal(calculateDraftPayrollMoney({...args,attendanceBonusEligible:false}).attendanceBonus,0);
});
test('Final Review does not mistake paid-period allowances or attendance bonus for changed compensation',()=>{
  const config={employee_employment_history_id:7,position:'Developer',department:'IT',employment_type:'probationary',monthly_basic_salary:15000,rice_allowance:500,transportation_allowance:500,attendance_bonus:500};
  const draft={employment_history_id:7,position_snapshot:'Developer',department_snapshot:'IT',employment_status_snapshot:'probationary',monthly_salary_snapshot:15000,rice_allowance:0,transportation_allowance:0,attendance_bonus:0};
  assert.equal(sameEffectiveCompensation(draft,config),true);
  assert.equal(sameEffectiveCompensation(draft,{...config,employee_employment_history_id:8}),false);
  assert.equal(sameEffectiveCompensation(draft,{...config,monthly_basic_salary:26000}),false);
});
test('Payroll Settings schema and update include the additive policy column',()=>{
  const src=source('server/services/payrollSettings.service.js');
  assert.match(src,/attendance_bonus_rule VARCHAR/);
  assert.match(src,/attendance_bonus_rule = \?/);
  assert.match(src,/next\.attendance_bonus_rule/);
  const migration=source('server/migrations/20261025_attendance_bonus_rule.sql');
  assert.match(migration,/ADD COLUMN IF NOT EXISTS attendance_bonus_rule/);
  assert.doesNotMatch(migration,/\b(?:DELETE|DROP|TRUNCATE|UPDATE)\b/i);
});
test('Draft and corrected payroll both calculate the approved bonus using attendance facts',()=>{
  for (const path of ['server/services/employeePayroll.service.js','server/services/payrollCorrection.service.js']) {
    const src=source(path);
    assert.match(src,/evaluateAttendanceBonus\(/);
    assert.match(src,/attendanceBonusAmount: compensation\.attendance_bonus/);
    assert.match(src,/attendanceBonusEligible: bonusEvaluation\.eligible/);
  }
});
test('Payroll writes eligible and explanatory fields in both update and insert paths',()=>{
  const src=source('server/services/employeePayroll.service.js');
  assert.match(src,/attendance_bonus_eligible = \?,\s*attendance_bonus_note = \?/);
  assert.match(src,/payload\.attendanceBonusEligible \? 1 : 0, payload\.attendanceBonusNote, existing/);
  assert.match(src,/\.\.\.commonValues, payload\.attendanceBonusEligible \? 1 : 0, payload\.attendanceBonusNote\]/);
});
test('Employees table exposes Other Actions with permission-limited options, edit and status separate',()=>{
  const src=source('client/src/pages/System/Employees.jsx');
  for(const label of ['Other Actions','Attendance Barcode','Employment History','Salary History','Promote / Change Salary','Deactivate','Edit']) assert.ok(src.includes(label));
  assert.match(src,/canViewPayrollHistory \?/);
  assert.match(src,/canCreateEmploymentChange \?/);
});
test('Salary warning links Payroll Settings and requires permission; first-hire policy is explained',()=>{
  const detail=source('client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx');
  const settings=source('client/src/components/System/employeeSalaryComponents/PayrollSettingsModal.jsx');
  assert.match(detail,/canManagePayrollSettings \?/);
  assert.match(detail,/Set Attendance Bonus Rule/);
  assert.match(settings,/id="attendance-bonus-settings"/);
  assert.match(settings,/saved Rest Days/);
  assert.match(settings,/first partial period/);
});
test('Receipt can print a marked Draft preview with print permission, but PDF export stays official-only',()=>{
  const src=source('client/src/components/System/employeeSalaryComponents/FundReleaseReceiptModal.jsx');
  const receipt=source('client/src/components/System/employeeSalaryComponents/FundReleaseReceipt.jsx');
  assert.match(src,/Print Draft Preview/);
  assert.match(src,/!canPrint/);
  assert.match(src,/receipt\?\.official && canExport/);
  assert.match(receipt,/Preview Only — Draft Payroll — Not Official/);
  assert.match(src,/\-DRAFT-NOT-OFFICIAL/);
});

