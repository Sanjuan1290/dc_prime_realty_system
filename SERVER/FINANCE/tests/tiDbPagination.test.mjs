import test from 'node:test';
import assert from 'node:assert/strict';
import {listAudit} from '../src/ledger.js';
import {listImportBatches} from '../src/importService.js';
import {getFinanceReconciliation} from '../src/reconciliation.js';
import {MAX_RECON_ROWS} from '../src/reconciliationPolicy.js';

for(const [name,fn] of [['audit',listAudit],['imports',listImportBatches]]) {
  test(`${name}: TiDB pagination uses checked integer literals`,async()=>{
    let calls=0;
    const pool={execute:async(sql,params)=>{calls++;assert.equal(params,undefined);if(sql.startsWith('SELECT COUNT'))return [[{total:75}]];assert.match(sql,name==='imports'?/LIMIT 20 OFFSET 20$/:/LIMIT 50 OFFSET 50$/);return [[{id:'synthetic',recorded_epoch:Date.parse('2026-11-18T02:00:00Z')/1000}]];}};
    const result=await fn({page:'2'},pool);
    assert.equal(result.page,2);assert.equal(result.items[0].id,'synthetic');assert.equal(result.total,75);assert.equal(calls,2);
  });
  test(`${name}: malformed pages fail before SQL`,async()=>{
    const pool={execute:()=>assert.fail('Invalid pages must not run SQL')};
    for(const page of ['1; DROP TABLE finance_users','1.5','NaN','0','-1','100001']) await assert.rejects(fn({page},pool),{code:'INVALID_PAGE'});
  });
}
test('audit timestamps use Manila once and audit details hide credentials',async()=>{
 const pool={execute:async sql=>sql.startsWith('SELECT COUNT')?[[{total:1}]]:[[{id:1,recorded_epoch:Date.parse('2026-11-18T02:00:00Z')/1000,metadata_json:JSON.stringify({password:'private',amount:'7500.00'})}]]};
 const result=await listAudit({},pool);assert.equal(result.items[0].created_at,'2026-11-18 10:00:00');assert.equal(result.items[0].recorded_at_utc,'2026-11-18T02:00:00.000Z');assert.equal(result.items[0].metadata_json.amount,'7500.00');assert.doesNotMatch(JSON.stringify(result),/private/);
});
test('reconciliation: TiDB limits are literals and date values stay bound',async()=>{
  const queries=[];let rolledBack=false,released=false;
  const conn={beginTransaction:async()=>{},rollback:async()=>{rolledBack=true},release:()=>{released=true},execute:async(sql,params)=>{
    assert.doesNotMatch(sql,/LIMIT\s+\?/);queries.push({sql,params});
    return [sql.includes('AS count')?[{count:0}]:[]];
  }};
  await getFinanceReconciliation({from:'2026-10-01',to:'2026-10-30'},{getConnection:async()=>conn});
  assert.equal(queries.length,5);assert.match(queries[0].sql,new RegExp(`LIMIT ${MAX_RECON_ROWS+1}$`));
  assert.deepEqual(queries[0].params,['2026-10-01','2026-10-30']);
  assert.match(queries[1].sql,/i\.`row_number`/);assert.ok(rolledBack&&released);
});
