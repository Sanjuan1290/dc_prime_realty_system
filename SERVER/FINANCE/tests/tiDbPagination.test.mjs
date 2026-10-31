import test from 'node:test';
import assert from 'node:assert/strict';
import {listAudit} from '../src/ledger.js';
import {listImportBatches} from '../src/importService.js';
import {getFinanceReconciliation} from '../src/reconciliation.js';
import {MAX_RECON_ROWS} from '../src/reconciliationPolicy.js';

for(const [name,fn] of [['audit',listAudit],['imports',listImportBatches]]) {
  test(`${name}: TiDB pagination uses checked integer literals`,async()=>{
    let calls=0;
    const pool={execute:async(sql,params)=>{calls++;assert.match(sql,/LIMIT 50 OFFSET 50$/);assert.equal(params,undefined);return [[{id:'synthetic'}]];}};
    const result=await fn({page:'2'},pool);
    assert.equal(result.page,2);assert.equal(result.items[0].id,'synthetic');assert.equal(calls,1);
  });
  test(`${name}: malformed pages fail before SQL`,async()=>{
    const pool={execute:()=>assert.fail('Invalid pages must not run SQL')};
    for(const page of ['1; DROP TABLE finance_users','1.5','NaN','0','-1','100001']) await assert.rejects(fn({page},pool),{code:'INVALID_PAGE'});
  });
}
test('reconciliation: TiDB limits are literals and date values stay bound',async()=>{
  const queries=[];let rolledBack=false,released=false;
  const conn={beginTransaction:async()=>{},rollback:async()=>{rolledBack=true},release:()=>{released=true},execute:async(sql,params)=>{
    assert.doesNotMatch(sql,/LIMIT\s+\?/);queries.push({sql,params});
    return [sql.includes('AS count')?[{count:0}]:[]];
  }};
  await getFinanceReconciliation({from:'2026-10-01',to:'2026-10-30'},{getConnection:async()=>conn});
  assert.equal(queries.length,4);assert.match(queries[0].sql,new RegExp(`LIMIT ${MAX_RECON_ROWS+1}$`));
  assert.deepEqual(queries[0].params,['2026-10-01','2026-10-30']);
  assert.match(queries[1].sql,/i\.`row_number`/);assert.ok(rolledBack&&released);
});
