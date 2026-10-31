import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAndStoreDraftPayroll} from '../services/employeePayroll.service.js';
test('standalone HR draft generation returns the domain error for a missing employee',async()=>{
  let employeeQueried=false;
  const connection={query:async(sql)=>{
    if(sql.includes('FROM employees e'))employeeQueried=true;
    return [[]];
  }};
  await assert.rejects(calculateAndStoreDraftPayroll(connection,{employeeId:42,period:{month:'2026-10',periodType:'first_half'},today:'2026-10-30'}),{code:'EMPLOYEE_NOT_FOUND',statusCode:404});
  assert.ok(employeeQueried);
});
