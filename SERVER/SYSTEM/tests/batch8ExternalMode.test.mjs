import test from 'node:test';
import assert from 'node:assert/strict';
process.env.FINANCE_SALARY_SOURCE='external';
const { loadFinanceSummary, FINANCE_ACTIVITY_SQL } = await import('../services/companyFinances.service.js?batch8-external-mode');
const payroll = {reference:'salary:12',txn_date:'2026-10-27',kind:'expense',amount:'123.45',source:'salary',recorded_at:'2026-10-27 20:00:00'};
function stub(sync){const queries=[];return {queries, async query(sql,args){queries.push(sql);if(sql===FINANCE_ACTIVITY_SQL)return [[payroll]];if(sql.includes('lot_project_cancelled_sale_archives'))return [[{cancelled_archives:0,unconfirmed_checks:0,refunds_to_review:0}]];if(sql.includes('finance_hr_sync_state'))return [[sync]];throw Error('Unexpected query '+sql)}};}
test('external finance mode never queries original payroll or cash advance tables',async()=>{
 const cx=stub({reconciled_through_date:null,cash_advances_to_review:null});
 const r=await loadFinanceSummary(cx,{from:'2026-10-01',to:'2026-10-27'});
 assert.equal(r.sources.salary_paid,123.45);assert.equal(r.balance_verified,false);
 assert.ok(r.warnings.some(x=>x.includes('not reconciled')));
 for (const sql of cx.queries) { assert.doesNotMatch(sql,/FROM employee_payrolls|FROM employee_cash_advances/); }
});
test('external reports verify only when manual reconciliation checkpoint covers date and advances reviewed',async()=>{
 const cx=stub({reconciled_through_date:'2026-10-27',reconciled_at:'2026-10-27 21:00:00',cash_advances_to_review:0});
 const r=await loadFinanceSummary(cx,{from:'2026-10-01',to:'2026-10-27'});
 assert.equal(r.balance_verified,true);assert.deepEqual(r.warnings,[]);
 assert.equal(r.available_balance,-123.45);
});
