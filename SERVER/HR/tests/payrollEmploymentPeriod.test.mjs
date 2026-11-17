import test from 'node:test';
import assert from 'node:assert/strict';
import {getPayrollEmploymentPeriodIssue} from '../services/payrollEmploymentPeriod.service.js';
import {assessPayrollReadiness} from '../services/payrollReadiness.service.js';
import {calculateAndStoreDraftPayroll} from '../services/employeePayroll.service.js';
const period={month:'2026-11',periodType:'first_half',periodStart:'2026-11-01',periodEnd:'2026-11-15'};
const employee={employee_id:42,employee_code:'QA-042',full_name:'Synthetic Robert',employee_status:'active',position:'QA Clerk',department:'Administration',employment_type:'regular',hire_date:'2026-11-16'};
test('Hire after the period has a specific date conflict; boundary and in-period hires retain their existing rules',()=>{
 const issue=getPayrollEmploymentPeriodIssue(employee,period);assert.equal(issue.code,'EMPLOYEE_HIRED_AFTER_PERIOD');assert.match(issue.message,/2026-11-16/);assert.match(issue.message,/2026-11-01 to 2026-11-15/);
 for(const hire_date of ['2026-11-01','2026-11-10','2026-11-15','2026-10-01'])assert.equal(getPayrollEmploymentPeriodIssue({...employee,hire_date},period),null);
 assert.equal(getPayrollEmploymentPeriodIssue({...employee,hire_date:new Date('2026-11-16T00:00:00Z')},period).code,issue.code);
});
test('Readiness does not misdiagnose a pre-hire period as missing salary or rest days',async()=>{
 const connection={query:async()=>{throw new Error('A pre-hire period must not read salary or attendance settings')}};
 const result=await assessPayrollReadiness(connection,employee,{period,today:'2026-11-16',settings:{}});
 assert.equal(result.eligible,false);assert.equal(result.can_generate,false);assert.deepEqual(result.issues.map(i=>i.code),['EMPLOYEE_HIRED_AFTER_PERIOD']);assert.deepEqual(result.warnings,[]);assert.equal(result.attendance.checked_days,0);
});
test('Direct generation cannot create payroll or period rows for someone hired after the pay period',async()=>{
 const queries=[],connection={query:async sql=>{queries.push(sql);return /FROM employees e/.test(sql)?[[employee]]:[[]]}};
 await assert.rejects(calculateAndStoreDraftPayroll(connection,{employeeId:42,period,today:'2026-11-16'}),{code:'EMPLOYEE_HIRED_AFTER_PERIOD',statusCode:409});
 assert.equal(queries.some(sql=>/\b(INSERT|UPDATE|DELETE)\b/i.test(sql)),false);
});
