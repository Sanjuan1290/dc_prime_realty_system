import test from 'node:test';
import assert from 'node:assert/strict';
import {dateOnly,timeOnly} from '../controllers/System/Employees/employeeModule.shared.js';

test('HR dates reject impossible calendar days and malformed values',()=>{
  for(const value of ['2026-02-30','2026-02-29','2026-04-31','2026-13-01','2026-00-10','2026-01-00','2026-01-01garbage','invalid'])assert.equal(dateOnly(value),null,value);
});
test('HR dates preserve leap days, database dates and ISO timestamps',()=>{
  for(const value of ['2024-02-29','2024-02-29T08:00:00Z','2024-02-29 08:00:00',new Date('2024-02-29T08:00:00Z')])assert.equal(dateOnly(value),'2024-02-29');
});
test('HR clock values reject invalid ranges, fragments and trailing input',()=>{
  for(const value of ['24:00','09:60','09:00:60','09:00garbage','09:00:00:00','09:00:xx','-1:00'])assert.equal(timeOnly(value),null,value);
});
test('HR clock values keep optional blank times and normalize supported times',()=>{
  for(const value of [null,undefined,''])assert.equal(timeOnly(value),null);
  assert.equal(timeOnly('9:05'),'09:05:00');assert.equal(timeOnly(' 09:05:30 '),'09:05:30');assert.equal(timeOnly('23:59:59'),'23:59:59');
});
