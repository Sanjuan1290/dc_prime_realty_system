import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryName,categoryKey,importDecision,summarizeUndo} from '../src/importPolicy.js';
import {financeMoney,sumPayments} from '../../../CLIENT/FINANCE/src/financeFormat.js';
import {ensureFinanceSchema} from '../src/liveSchema.js';
const row={category:'Salary',source_revision_sha256:'a'.repeat(64)};
test('file categories are automatic; no manual mapping is needed',()=>{
  assert.equal(categoryName({...row,category:'  Salary  '}),'Salary');
  assert.equal(categoryKey('expense','Salary'),categoryKey('expense','SALARY'));
  assert.notEqual(categoryKey('income','Salary'),categoryKey('expense','Salary'));
  assert.equal(importDecision(row,null),'new');
  assert.throws(()=>categoryName({...row,category:'   '}));
});
test('only a payment removed by import undo can be restored with an identical fingerprint',()=>{
  assert.equal(importDecision(row,{...row,status:'posted'}),'duplicate');
  assert.equal(importDecision(row,{...row,status:'void',void_reason:'Import undone: abc'}),'restore');
  assert.equal(importDecision(row,{...row,status:'void',void_reason:'Unrelated correction'}),'conflict');
  assert.equal(importDecision(row,{...row,status:'void',void_reason:'Import undone: abc',source_revision_sha256:'b'.repeat(64)}),'conflict');
});
test('undo impact excludes shared payments and previously removed payments using exact centavos',()=>{
  const batch={id:'batch',status:'committed',file_name:'cash.zip'};
  const payments=[{id:1,status:'posted',kind:'expense',amount:'123.45',other_imports:0},{id:2,status:'posted',kind:'income',amount:'80.12',other_imports:0},{id:3,status:'posted',kind:'expense',amount:'200.00',other_imports:1},{id:4,status:'void',kind:'expense',amount:'100.00',other_imports:0}];
  const result=summarizeUndo(batch,payments);
  assert.deepEqual(result.impact,{removed:2,kept:1,already_removed:1,money_in_removed:'80.12',money_out_removed:'123.45',balance_change:'43.33'});
  assert.notEqual(result.review_token,summarizeUndo(batch,payments.map((payment,i)=>i===0?{...payment,other_imports:1}:payment)).review_token);
});
test('confirmation totals retain centavos beyond floating-point precision',()=>{
  assert.equal(sumPayments([{decision:'new',kind:'income',amount:'9999999999999.99'},{decision:'restore',kind:'income',amount:'0.01'},{decision:'duplicate',kind:'income',amount:'500.00'}],'income'),'10000000000000.00');
  assert.equal(financeMoney('10000000000000.01'),'₱10,000,000,000,000.01');
  assert.equal(financeMoney('-0.01'),'-₱0.01');
});
test('an upgraded database can start without DDL privileges',async()=>{
  const metadata=[{TABLE_NAME:'finance_import_batches',COLUMN_NAME:'status',COLUMN_TYPE:"enum('preview','committed','rejected','undone')"},...['undone_by','undone_at','undo_reason','undo_result_json'].map(COLUMN_NAME=>({TABLE_NAME:'finance_import_batches',COLUMN_NAME})),{TABLE_NAME:'finance_import_items',COLUMN_NAME:'decision',COLUMN_TYPE:"enum('new','restore','duplicate','conflict','unmapped','imported')"},{TABLE_NAME:'finance_categories',COLUMN_NAME:'name',CHARACTER_MAXIMUM_LENGTH:200},{TABLE_NAME:'finance_import_mutex',COLUMN_NAME:'id'}];
  await ensureFinanceSchema({execute:async sql=>{
    if(sql.startsWith('SELECT COLUMN_NAME'))return [[...['must_change_password','temporary_password_expires_at','invitation_sent_at'].map(COLUMN_NAME=>({COLUMN_NAME}))]];
    if(sql.startsWith('SELECT TABLE_NAME'))return [metadata];
    assert.equal(sql,'INSERT IGNORE INTO finance_import_mutex(id) VALUES(1)','Existing schema must not need CREATE or ALTER permissions');return [{affectedRows:0}];
  }});
});
