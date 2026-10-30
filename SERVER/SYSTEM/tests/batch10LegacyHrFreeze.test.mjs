import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLegacyHrFreeze, parseLegacyHrMode,classifyLegacyHrRoute } from '../middleware/legacyHrFreeze.middleware.js';
function request(mode,path,method='POST'){
  const handler=makeLegacyHrFreeze(mode);let next=false;let status,body,cache;
  const response={set(_key,v){cache=v;return this;},status(n){status=n;return this;},json(b){body=b;return this;}};
  handler({path,method},response,()=>{next=true});return {next,status,body,cache};
}
test('mode validation rejects typo instead of silently re-enabling writes',()=>{
  assert.equal(parseLegacyHrMode(undefined),'active');
  assert.throws(()=>parseLegacyHrMode('deployed'));
});
test('active mode never intercepts existing application',()=>assert.equal(request('active','/employees','POST').next,true));
for(const name of ['/employees','/employees/15','/attendance/events','/employee-payroll/payrolls/7/release','/attendance-kiosk/scan']){
  test('frozen rejects legacy HR write '+name,()=>{
    const r=request('frozen',name,'POST');assert.equal(r.status,423);assert.equal(r.body.code,'LEGACY_HR_WRITES_FROZEN');
  });
}
test('frozen allows legacy HR read and keeps property payments working',()=>{
  assert.equal(request('frozen','/employee-payroll/drafts','GET').next,true);
  assert.equal(request('frozen','/projects/1/payments','POST').next,true);
  assert.equal(request('retired','/public/buyer-forms','POST').next,true);
  assert.equal(request('retired','/company-finances','GET').next,true);
});
test('seller import commit/undo blocked but preview permitted',()=>{
  assert.equal(request('frozen','/seller-groups/1/members/import/commit').status,423);
  assert.equal(request('frozen','/seller-groups/1/members/import/77/undo').status,423);
  assert.equal(request('frozen','/seller-groups/1/members/import/preview').next,true);
});
test('retired denies legacy HR reads too',()=>{
  assert.equal(request('retired','/employees','GET').status,410);
  assert.equal(request('retired','/employee-payroll/drafts/2','GET').status,410);
  assert.equal(request('retired','/seller-groups/1/members/import/commit').status,423);
});
test('OPTIONS remains available for CORS',()=>assert.equal(request('retired','/attendance/records','OPTIONS').next,true));
test('prefix routing does not catch unrelated paths',()=>{
  assert.equal(classifyLegacyHrRoute('/employeesx'),null);
  assert.equal(classifyLegacyHrRoute('/employee-payrolls'),null);
  assert.equal(request('retired','/payments/attendance-fee','POST').next,true);
});
