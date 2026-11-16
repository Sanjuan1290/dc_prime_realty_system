import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSalaryFinanceSnapshot,buildFinanceTransferZip,buildFinanceExcel} from '../../HR/services/salaryFinanceExport.service.js';
import {buildFinanceExportSnapshot} from '../../SYSTEM/services/companyFinanceExport.service.js';
import {validateSnapshot,canonicalCsv,sha256,summarize} from '../src/importContract.js';
import {parseUpload} from '../src/importFile.js';
const event={source_system:'hr',event_type:'salary.cash_released.v1',source_payroll_id:'42',cash_date:'2026-01-15',recorded_at:'2026-01-15T01:02:03.456Z',amount:'12345.67'};
const payroll={employee_payroll_id:42,released_date:event.cash_date,net_fund_release:event.amount,payload_json:JSON.stringify(event)};
const snapshot=()=>buildSalaryFinanceSnapshot({payrolls:[payroll],from:'2026-01-01',to:'2026-01-31'});
test('HR ZIP and Excel exports pass the real Finance file parser',async()=>{
  const s=snapshot();
  for(const [format,build] of [['zip',buildFinanceTransferZip],['xlsx',buildFinanceExcel]]){
    const result=await parseUpload({format,buffer:await build(s)});
    assert.equal(result.totals.money_out,'12345.67');assert.equal(result.rows[0].source_system,'hr');
    assert.deepEqual(result.rows,s.rows);
  }
});
test('HR and external Company Finances exports give the same salary payment the same identity and revision',()=>{
  const hr=snapshot(),row=hr.rows[0];
  const realty=buildFinanceExportSnapshot({from:'2026-01-01',to:'2026-01-31',overview:{balance_verified:true,hr_salary_sync:true,warnings:[]},transactions:[{reference:'salary:42',txn_date:event.cash_date,kind:'expense',amount:event.amount,title:'Salary payment #42',category:'Salary',source:'salary',recorded_at:'2026-01-15 09:02:03'}]});
  assert.deepEqual(realty.rows[0],row);validateSnapshot(realty);
});
test('HR export refuses missing events, changed cash values, oversized and empty exports',()=>{
  for(const payrolls of [[],[{...payroll,payload_json:null}],[{...payroll,net_fund_release:'1.00'}],Array(501).fill(payroll)])assert.throws(()=>buildSalaryFinanceSnapshot({payrolls,from:'2026-01-01',to:'2026-01-31'}));
});
test('HR files cannot disguise unrelated income or manual transactions as salary releases',()=>{
  const s=snapshot();s.rows[0].source_type='manual';s.csv=canonicalCsv(s.rows);s.manifest.transactions_sha256=sha256(s.csv);s.manifest.snapshot=summarize(s.rows);
  assert.throws(()=>validateSnapshot(s),/unsupported HR payment/);
});
