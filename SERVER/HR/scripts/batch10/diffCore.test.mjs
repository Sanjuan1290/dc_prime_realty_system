import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTable} from './diffCore.mjs';
const pk=['employee_id'];
test('equal sets despite order and object key ordering',()=>{
  const a=[{employee_id:1,n:'x'},{employee_id:2,n:'y'}],b=[{n:'y',employee_id:2},{n:'x',employee_id:1}];
  assert.equal(compareTable(a,b,pk).match,true);
});
test('changed row detected even when count matches',()=>{
  const r=compareTable([{employee_id:1,amount:'100.00'}],[{employee_id:1,amount:'100.01'}],pk);
  assert.equal(r.match,false);assert.equal(r.changed,1);
});
test('new/missing keys detected',()=>{
  const r=compareTable([{employee_id:1}],[{employee_id:2}],pk);
  assert.equal(r.source_only,1);assert.equal(r.target_only,1);
});
test('duplicate PK is rejected',()=>assert.throws(()=>compareTable([{employee_id:1},{employee_id:1}],[],pk)));
test('stable canonical data does not expose plaintext to comparison digest',()=>{
  const r=compareTable([{employee_id:1,name:'private name'}],[{employee_id:1,name:'private name'}],pk);
  assert.equal(r.match,true);assert.doesNotMatch(JSON.stringify(r),/private name/);
});
