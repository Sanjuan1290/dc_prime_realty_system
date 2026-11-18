import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFinanceReport,getFinanceReport} from '../src/reports.js';
import {getImportDetails} from '../src/importService.js';
import {listAudit} from '../src/ledger.js';
import {financeDateTime} from '../../../CLIENT/FINANCE/src/financeFormat.js';

const from='2026-11-16',to='2026-11-18';
const rows=[
  {bucket:'',kind:'income',amount:'100.00',record_count:1},
  {bucket:'2026-11-16',kind:'income',amount:'403866.66',record_count:3,source_system:'realty',category_id:1,category_name:'Property Collections'},
  {bucket:'2026-11-17',kind:'expense',amount:'7462.50',record_count:1,source_system:'hr',category_id:2,category_name:'Salary'},
];

test('Finance reports carry forward the opening balance and use centavos',()=>{
  const report=buildFinanceReport(rows,{from,to});
  assert.equal(report.closing_balance,'396504.16');
  assert.equal(report.net_change,'396404.16');
  assert.deepEqual(report.series.map(row=>row.balance),['403966.66','396504.16','396504.16']);
  assert.equal(report.period_count,4);
  assert.equal(report.categories[1].amount,'7462.50');
});

test('Breakdown filters keep the account-wide summary and running balance',()=>{
  const report=buildFinanceReport(rows,{from,to,kind:'expense',source:'hr',category_id:'2'});
  assert.equal(report.money_in,'403866.66');
  assert.equal(report.series[0].income,'0.00');
  assert.equal(report.series[0].balance,'403966.66');
  assert.equal(report.filtered_money_out,'7462.50');
  assert.equal(report.matched_count,1);
  assert.deepEqual(report.categories.map(({name})=>name),['Salary']);
});

test('Report query counts only posted entries and requests monthly totals for longer dates',async()=>{
  const report=await getFinanceReport({from:'2026-01-01',to:'2026-11-18'},{execute:async(sql,params)=>{
    assert.equal((sql.match(/status='posted'/g)||[]).length,4);
    assert.deepEqual(params,['2026-11-18','2026-01-01','%Y-%m','2026-01-01','2026-11-18']);
    return [[rows[0]]];
  }});
  assert.equal(report.bucket_size,'month');
  assert.equal(report.series.length,11);
  assert.equal(report.period_count,0);
  assert.equal(report.closing_balance,'100.00');
});

test('Actual totals exclude canceled payroll pairs while gross activity and the net stay intact',()=>{
  const report=buildFinanceReport([
    rows[1],
    {...rows[2],amount:'14925.00',record_count:2,payroll_correction_amount:'7462.50',payroll_correction_count:1},
    {...rows[2],kind:'income',amount:'7462.50',payroll_correction_amount:'7462.50',payroll_correction_count:1},
  ],{from,to});
  assert.equal(report.money_in,'411329.16');assert.equal(report.money_out,'14925.00');
  assert.equal(report.actual_money_in,'403866.66');assert.equal(report.actual_money_out,'7462.50');
  assert.equal(report.net_change,'396404.16');assert.equal(report.closing_balance,'396404.16');
  assert.equal(report.period_count,6);assert.equal(report.payroll_correction_count,2);
  assert.equal(report.categories.find(category=>category.kind==='expense').amount,'14925.00');
});

test('Actual totals preserve centavos above floating-point precision and stay account-wide under filters',()=>{
  const report=buildFinanceReport([
    {...rows[1],amount:'90071992547409.93'},
    {...rows[2],amount:'90071992547409.92',payroll_correction_amount:'90071992547409.91',payroll_correction_count:1},
    {...rows[2],kind:'income',amount:'90071992547409.91',payroll_correction_amount:'90071992547409.91',payroll_correction_count:1},
  ],{from,to,kind:'expense',source:'hr',category_id:'2'});
  assert.equal(report.actual_money_in,'90071992547409.93');assert.equal(report.actual_money_out,'0.01');
  assert.equal(report.net_change,'90071992547409.92');assert.equal(report.matched_count,1);
});

test('Cross-period payroll corrections keep gross timing separate from the unreversed actual payments',()=>{
  const report=buildFinanceReport([
    {...rows[0],kind:'expense',amount:'7462.50'},
    {...rows[2],kind:'income',amount:'7462.50',payroll_correction_amount:'7462.50',payroll_correction_count:1},
    {...rows[2],amount:'8000.01'},
  ],{from,to});
  assert.equal(report.actual_money_in,'0.00');assert.equal(report.actual_money_out,'8000.01');
  assert.equal(report.net_change,'-537.51');assert.equal(report.closing_balance,'-8000.01');
  assert.equal(report.payroll_correction_money_out,'0.00');assert.equal(report.total_posted,3);
});

test('Import history identifies the exact existing ledger record and restores separately',async()=>{
  const id='87edc934-51a5-433f-b9bd-b6e826d2c6fd';
  const result=await getImportDetails(id,{execute:async(sql,params)=>{
    assert.deepEqual(params,[id]);
    if(sql.includes('FROM finance_import_batches'))return [[{id,status:'committed',result_json:'{"restored":1}'}]];
    if(sql.includes('FROM finance_audit_logs'))return [[{entity_id:'24'}]];
    return [[
      {row_number:2,existing_transaction_id:'23',decision:'duplicate',source_row_json:{amount:'176933.33'}},
      {row_number:3,existing_transaction_id:'24',decision:'imported',source_row_json:{amount:'50000.00'}},
    ]];
  }});
  assert.deepEqual(result.items.map(item=>[item.existing_transaction_id,item.decision,item.amount]),
    [['23','duplicate','176933.33'],['24','restored','50000.00']]);
});

test('Audit day filters and 12-hour timestamps use Philippine time once',async()=>{
  const day='2026-11-18';
  const result=await listAudit({from:day,to:day},{execute:async(sql,params)=>{
    assert.deepEqual(params,[Date.parse('2026-11-17T16:00:00Z')/1000,Date.parse('2026-11-18T16:00:00Z')/1000]);
    if(sql.startsWith('SELECT COUNT')) return [[{total:1}]];
    return [[{id:1,recorded_epoch:Date.parse('2026-11-18T04:59:00Z')/1000}]];
  }});
  assert.equal(financeDateTime(result.items[0].recorded_at_utc),'18 Nov 2026, 12:59 PM');
  assert.equal(financeDateTime(result.items[0].created_at,{local:true}),'18 Nov 2026, 12:59 PM');
  assert.equal(financeDateTime('2026-11-17 17:05:00'),'18 Nov 2026, 1:05 AM');
});
