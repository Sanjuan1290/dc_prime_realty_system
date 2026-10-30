import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueSalaryRelease } from '../services/salaryOutbox.service.js';
const createConn=()=>({queries:[],async query(sql,args){this.queries.push({sql,args});return [{affectedRows:1}]}});
test('released payroll enqueues one immutable salary event with no employee PII',async()=>{
 const db=createConn();const e=await enqueueSalaryRelease(db,{employee_payroll_id:42,net_fund_release:'1234.50',payroll_status:'released'},'2026-10-27');
 assert.equal(e.amount,'1234.50');assert.equal(e.reference,'HR-PAYROLL-42-RELEASE-1');
 assert.equal(e.display_label,'Salary payment #42');assert.equal(db.queries.length,1);
 assert.match(db.queries[0].sql,/INSERT INTO hr_outbox_events/);
});
test('zero cash release does not create expense event',async()=>{
 const db=createConn();const e=await enqueueSalaryRelease(db,{employee_payroll_id:42,net_fund_release:'0.00',payroll_status:'released'},'2026-10-27');
 assert.equal(e,null);assert.equal(db.queries.length,0);
});
test('draft and bad money values cannot create transfer',async()=>{
 const db=createConn();await assert.rejects(enqueueSalaryRelease(db,{employee_payroll_id:42,net_fund_release:'100',payroll_status:'draft'},'2026-10-27'));
 await assert.rejects(enqueueSalaryRelease(db,{employee_payroll_id:42,net_fund_release:'-3.00',payroll_status:'released'},'2026-10-27'));
 assert.equal(db.queries.length,0);
});
