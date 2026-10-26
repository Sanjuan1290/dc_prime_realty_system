import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {computeCashSummary, validateFinanceEntry, moneyAmount, dateOnly, FINANCE_ACTIVITY_SQL, loadFinanceSummary, summarizeSourceExclusions} from '../services/companyFinances.service.js';
const entry={kind:'expense',amount:'123.45',category_id:5,description:'Office electricity',transaction_date:'2026-10-26'};
const settings={start_date:'2026-10-01'};
const activity=[
  {reference:'property:1',txn_date:'2026-10-02',kind:'income',amount:'50000.00',source:'property'},
  {reference:'salary:11',txn_date:'2026-10-10',kind:'expense',amount:'6957.48',source:'salary'},
  {reference:'commission:8',txn_date:'2026-10-11',kind:'expense',amount:'2000.00',source:'commission'},
  {reference:'manual:9',txn_date:'2026-10-15',kind:'income',amount:'250.10',source:'manual'},
];
test('accepts positive two-place amounts',()=>{assert.equal(moneyAmount('12.01'),'12.01');assert.equal(moneyAmount(200),'200.00')});
test('rejects zero, negative, nonnumeric and three decimal amounts',()=>{for(const v of ['0','-1','4.001','abc',null,'NaN'])assert.throws(()=>moneyAmount(v))});
test('validates real date only',()=>{assert.equal(dateOnly('2026-10-26'),'2026-10-26');for(const v of ['2026-02-30','2026-13-01','1/1/2026','2026-1-1'])assert.throws(()=>dateOnly(v))});
test('manual transaction fields validated and trimmed',()=>{const e=validateFinanceEntry({...entry,description:'  Office electricity  '},settings);assert.equal(e.description,'Office electricity');assert.equal(e.amount,'123.45')});
test('manual entries cannot be backdated before opening date',()=>assert.throws(()=>validateFinanceEntry({...entry,transaction_date:'2026-09-30'},settings),/starting date/));
test('manual entries cannot be posted before finance setup',()=>assert.throws(()=>validateFinanceEntry(entry,{}),/opening balance/));
test('manual entries cannot be future dated',()=>assert.throws(()=>validateFinanceEntry({...entry,transaction_date:'2030-01-01'},settings),/Future/));
test('category id, kind and description required',()=>{for(const patch of [{category_id:0},{kind:'other'},{description:''}])assert.throws(()=>validateFinanceEntry({...entry,...patch},settings))});
test('available cash includes opening, collections, salary, commissions and income',()=>{
 const s=computeCashSummary({openingBalance:'1000.00',startDate:'2026-10-01',from:'2026-10-01',to:'2026-10-26',activities:activity});
 assert.equal(s.money_in,50250.10);assert.equal(s.money_out,8957.48);assert.equal(s.available_balance,42292.62);
});
test('custom date filter carries earlier activity into opening balance',()=>{
 const s=computeCashSummary({openingBalance:'1000.00',startDate:'2026-10-01',from:'2026-10-10',to:'2026-10-26',activities:activity});
 assert.equal(s.opening_for_range,51000);assert.equal(s.money_in,250.10);assert.equal(s.available_balance,42292.62);
});
test('exclude property receipts if company does not own them',()=>{
 const s=computeCashSummary({openingBalance:1000,startDate:'2026-10-01',from:'2026-10-01',to:'2026-10-26',activities:activity,includeProperty:false});
 assert.equal(s.available_balance,-7707.38);
});
test('future activity after To excluded',()=>{
 const s=computeCashSummary({openingBalance:0,startDate:'2026-10-01',from:'2026-10-01',to:'2026-10-09',activities:activity});assert.equal(s.money_in,50000);assert.equal(s.money_out,0);
});
test('invalid date range rejects',()=>assert.throws(()=>computeCashSummary({openingBalance:0,startDate:'2026-10-01',from:'2026-10-26',to:'2026-10-10',activities:activity})));
test('source SQL uses only released salary and net cash paid',()=>{assert.match(FINANCE_ACTIVITY_SQL,/payroll_status='released'/);assert.match(FINANCE_ACTIVITY_SQL,/net_fund_release/);assert.doesNotMatch(FINANCE_ACTIVITY_SQL,/gross_pay/)});
test('commission payouts only Released and net',()=>{assert.match(FINANCE_ACTIVITY_SQL,/r\.net_release_amount/);assert.match(FINANCE_ACTIVITY_SQL,/release_status='Released'/);assert.match(FINANCE_ACTIVITY_SQL,/NOT EXISTS/)});
test('avoids representing a cheque as cash before clearing',()=>assert.match(FINANCE_ACTIVITY_SQL,/lot_project_payment_method <> 'Check'/));
test('never duplicates seller commissions as manual transactions by source',()=>{assert.match(FINANCE_ACTIVITY_SQL,/manual:/);assert.match(FINANCE_ACTIVITY_SQL,/commission:/);assert.match(FINANCE_ACTIVITY_SQL,/network:/)});
test('unconfigured status never guesses zero',async()=>{
 const db={query:async()=>[[{start_date:null,opening_balance:null}]]};const s=await loadFinanceSummary(db,{from:'2026-10-01',to:'2026-10-26'});assert.equal(s.configured,false);assert.equal(s.available_balance,undefined);
});
test('warnings block verified badge for unreviewed archive, checks, and advances',async()=>{
 const db={query:async sql=>{
  if(sql.includes('company_finance_settings'))return [[{start_date:'2026-10-01',opening_balance:'0.00',includes_property_collections:1}]];
  if(sql.includes('SELECT * FROM ('))return [activity];
  return [[{cancelled_archives:2,unconfirmed_checks:1,cash_advances_to_review:3}]];
 }};
 const s=await loadFinanceSummary(db,{from:'2026-10-01',to:'2026-10-26'});
 assert.equal(s.configured,true);assert.equal(s.balance_verified,false);assert.equal(s.warnings.length,3);
});
test('migration does not alter historical payment or payroll tables',()=>{
 const migration=fs.readFileSync(new URL('../migrations/20261026_company_finances_simple.sql',import.meta.url),'utf8');
 assert.doesNotMatch(migration,/UPDATE\s+employee_payrolls|ALTER TABLE\s+lot_project_payments|DELETE FROM\s+lot_project_commissions/i);
 assert.match(migration,/company_finance_transactions/);
});
test('new finance endpoints permission gated; report card not rendered to unauthorized user',()=>{
 const route=fs.readFileSync(new URL('../routers/System/companyFinances.routers.js',import.meta.url),'utf8');
 const reports=fs.readFileSync(new URL('../../client/src/pages/System/Reports.jsx',import.meta.url),'utf8');
 assert.match(route,/authenticateUser/);assert.match(route,/COMPANY_FINANCES_RECORD/);assert.match(route,/COMPANY_FINANCES_CATEGORIES/);
 assert.match(reports,/canViewCompanyFinances \?/);
});
test('existing payroll release still follows finalized-only one-way status transition',()=>{
 const service=fs.readFileSync(new URL('../services/payrollRelease.service.js',import.meta.url),'utf8');
 assert.match(service,/payroll_status IN \('finalized','corrected'\)/);
 assert.match(service,/normalized\.releaseNotes,\s*normalized\.releaseWitnessName,\s*payrollId/);
});

test('Oct 25 actual source receipts reconcile to the Cash Collected card and released payouts',()=>{
 const actual=[
  {reference:'property:1',txn_date:'2026-10-25',kind:'income',amount:'50000.00',source:'property'},
  {reference:'property:2',txn_date:'2026-10-25',kind:'income',amount:'128700.00',source:'property'},
  {reference:'property:3',txn_date:'2026-10-25',kind:'income',amount:'18869.44',source:'property'},
  ...[6240,2496,1974.34,1769.66].map((amount,i)=>({reference:`commission:${i+1}`,txn_date:'2026-10-25',kind:'expense',amount,source:'commission'})),
  {reference:'network:1',txn_date:'2026-10-25',kind:'expense',amount:'1560.00',source:'network_payout'},
  {reference:'salary:1',txn_date:'2026-10-25',kind:'expense',amount:'6957.48',source:'salary'},
 ];
 const summary=computeCashSummary({openingBalance:0,startDate:'2026-10-25',from:'2026-10-01',to:'2026-10-31',activities:actual});
 assert.equal(summary.money_in,197569.44);
 assert.equal(summary.money_out,20997.48);
 assert.equal(summary.available_balance,176571.96);
 const excl= summarizeSourceExclusions({rows:actual,start:'2026-10-26',from:'2026-10-01',to:'2026-10-31',includeProperty:true});
 assert.equal(excl.before_start.property_collections,197569.44);
 assert.equal(excl.before_start.salary_paid,6957.48);
 assert.equal(excl.before_start.commissions_paid,14040);
 assert.equal(excl.before_start.count,9);
});
test('before-start and opted-out payments are shown explicitly rather than silently lost',async()=>{
 const rows=[
  {reference:'property:1',txn_date:'2026-10-25',kind:'income',amount:'197569.44',source:'property'},
  {reference:'salary:1',txn_date:'2026-10-25',kind:'expense',amount:'6957.48',source:'salary'},
  {reference:'property:2',txn_date:'2026-10-27',kind:'income',amount:'9000.00',source:'property'},
  {reference:'manual:5',txn_date:'2026-10-27',kind:'expense',amount:'2055.00',source:'manual'},
 ];
 const calls=[];
 const db={query:async(sql,params=[])=>{
  if(sql.includes('FROM company_finance_settings'))return [[{start_date:'2026-10-26',opening_balance:'1555.00',includes_property_collections:0}]];
  if(sql.includes('SELECT * FROM (')){calls.push(params);return [rows]}
  return [[{cancelled_archives:0,unconfirmed_checks:0,cash_advances_to_review:0,refunds_to_review:0}]];
 }};
 const report=await loadFinanceSummary(db,{from:'2026-10-01',to:'2026-10-31'});
 assert.deepEqual(calls,[['2026-10-01','2026-10-31']]);
 assert.equal(report.money_in,0);
 assert.equal(report.money_out,2055);
 assert.equal(report.available_balance,-500);
 assert.equal(report.exclusions.before_start.property_collections,197569.44);
 assert.equal(report.exclusions.before_start.salary_paid,6957.48);
 assert.equal(report.exclusions.property_excluded_by_setting,9000);
 assert.equal(report.balance_verified,false);
 assert.ok(report.warnings.some(w=>w.includes('Finance Starting Date')));
 assert.ok(report.warnings.some(w=>w.includes('Include Property Collections')));
});
test('opening-balance correction is permission gated, requires an explanation and keeps audit history',()=>{
 const controller=fs.readFileSync(new URL('../controllers/System/companyFinances.controller.js',import.meta.url),'utf8');
 const routes=fs.readFileSync(new URL('../routers/System/companyFinances.routers.js',import.meta.url),'utf8');
 assert.match(routes,/router\.put\('\/opening-balance',requirePermission\(PERMISSIONS\.COMPANY_FINANCES_OPENING_BALANCE\),finance\.correctOpeningBalance\)/);
 assert.match(controller,/Finance Starting Balance Corrected/);
 assert.match(controller,/transaction_date < \?/);
 assert.match(controller,/req\.body\?\.confirmed!==true/);
 assert.match(controller,/\{before,after,reason\}/);
});
