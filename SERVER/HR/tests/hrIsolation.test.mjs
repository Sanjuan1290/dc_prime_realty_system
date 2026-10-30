import test from 'node:test';import { readFileSync, readdirSync } from 'node:fs';import { join, dirname } from 'node:path';import { fileURLToPath } from 'node:url';import assert from 'node:assert/strict';
import { calculatePayrollRates, calculateAttendanceDeduction, calculateDraftPayrollMoney } from '../services/payrollCalculation.service.js';
import { computeNewHireWorkdayFraction } from '../services/payrollNewHireProration.service.js';
import { normalizeDepartmentConfigs } from '../controllers/System/Employees/departmentBarcode.shared.js';
import { PERMISSIONS } from '../config/permissions.js';
import { getManilaDateTime } from '../controllers/System/Employees/attendanceLite.shared.js';
test('payroll basic calculation preserves 8-hour divisor',()=>{const v=calculatePayrollRates({monthlyBasicSalary:15000,regularWorkingMinutes:600});assert.equal(v.regularHoursPerDay,8);assert.equal(v.halfMonthBasic,7500)});
test('attendance default timezone is Manila',()=>{assert.equal(getManilaDateTime(new Date('2026-10-27T08:00:00Z')).date,'2026-10-27')});
test('HR access permissions are scoped',()=>{assert.ok(PERMISSIONS.PAYROLL_RELEASE);assert.ok(!Object.values(PERMISSIONS).some(x=>x.startsWith('lot_project.')))});
test('department codes preserved',()=>{assert.ok(normalizeDepartmentConfigs(null,null).length >= 3)});

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(root, rel),'utf8');
test('payroll signed example: 1,830 late/absence minutes',()=>{
 const r=calculatePayrollRates({monthlyBasicSalary:15000,regularWorkingMinutes:600});
 assert.equal(r.hourlyRate,86.54);
 assert.equal(calculateAttendanceDeduction({tardinessAbsenceMinutes:1830,hourlyRate:r.hourlyRate}),2639.47);
 const d=calculateDraftPayrollMoney({monthlyBasicSalary:15000,regularWorkingMinutes:600,tardinessAbsenceMinutes:1830,periodType:'first_half',riceAllowance:500,transportationAllowance:500});
 assert.equal(d.netFundRelease,4860.53);
});
test('runtime HR schema never creates or alters tables',()=>{
 for(const fn of ['controllers/System/Employees/employeeModule.shared.js','controllers/System/Employees/attendanceLite.shared.js','services/employeePayroll.service.js','services/payrollSettings.service.js']){
  const src=read(fn);assert.doesNotMatch(src,/\b(?:CREATE TABLE|ALTER TABLE)\b/i,fn);
 }
});
test('payroll release remains staging-gated and signed receipt endpoint remains blocked',()=>{
 const src=read('routers/System/employeePayroll.routers.js');
 assert.match(src,/HR_ALLOW_PAYROLL_RELEASE/);
 assert.match(src,/HR_ENABLE_SALARY_DELIVERY/);
 assert.match(src,/HR_SIGNED_RECEIPTS_PENDING/);
 assert.match(src,/releaseEmployeePayroll\);/);
});
test('new HR database name can never default to Realty',()=>{
 const src=read('db/connect.js');assert.match(src,/HR_DB_NAME/);assert.doesNotMatch(src,/TIDB_DATABASE|REALTY_DB/);
});
test('no active HR scheduler unless staging write flags are enabled',()=>{
 const src=read('server.js');assert.match(src,/HR_ENABLE_JOBS/);assert.match(src,/writesAllowed/);
 assert.doesNotMatch(src,/startDailyPenaltyScheduler/);
});
test('HR settings query reads only HR settings',()=>{
 const src=read('controllers/System/Employees/attendanceLite.shared.js');assert.match(src,/FROM hr_settings/);assert.doesNotMatch(src,/FROM system_settings/);
});
