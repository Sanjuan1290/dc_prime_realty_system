import test from 'node:test';
import assert from 'node:assert/strict';
import {listTransactions} from '../src/ledger.js';

test('transaction source, category, type and status filter the records and pagination count together', async () => {
  const queries=[];
  const pool={execute:async(sql,values)=>{
    queries.push({sql,values});
    assert.match(sql,/t\.kind=\?/);assert.match(sql,/t\.status=\?/);assert.match(sql,/t\.source_system=\?/);assert.match(sql,/t\.category_id=\?/);
    assert.deepEqual(values,['2026-11-01','2026-11-18','expense','posted','hr','2']);
    return sql.startsWith('SELECT COUNT')?[[{total:23}]]:[[{id:7,source_system:'hr',category_id:2,kind:'expense',amount:'7462.50'}]];
  }};
  const result=await listTransactions({from:'2026-11-01',to:'2026-11-18',kind:'expense',status:'posted',source:'hr',category_id:'2',page:2,page_size:10},pool);
  assert.equal(queries.length,2);assert.match(queries[1].sql,/LIMIT 10 OFFSET 10/);assert.equal(result.total,23);assert.equal(result.transactions[0].amount,'7462.50');
});
test('all transaction sources do not add a source restriction', async () => {
  const pool={execute:async(sql,values)=>{
    assert.doesNotMatch(sql,/t\.source_system=\?/);assert.deepEqual(values,['2026-11-01','2026-11-18']);
    return sql.startsWith('SELECT COUNT')?[[{total:0}]]:[[]];
  }};
  const result=await listTransactions({from:'2026-11-01',to:'2026-11-18',source:'all',status:'all'},pool);
  assert.deepEqual(result.transactions,[]);assert.equal(result.total,0);
});
test('invalid source and category filters are rejected before reading transaction rows',async()=>{
  const pool={execute:()=>{throw new Error('Invalid filters must not execute SQL');}};
  await assert.rejects(listTransactions({source:"hr' OR 1=1"},pool),{code:'INVALID_SOURCE'});
  await assert.rejects(listTransactions({source:'hr',category_id:'not-an-id'},pool),{code:'INVALID_ID'});
});
