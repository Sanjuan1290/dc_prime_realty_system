import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('roles preserve operations attendance/accounting salary split',()=>{
  const s=read('../config/recommendedRolePermissions.js');
  const op=s.split('operations_staff: Object.freeze([')[1].split(']),')[0];
  const ac=s.split('accounting_staff: Object.freeze([')[1].split(']),')[0];
  assert.match(op,/ATTENDANCE_MANAGE/);assert.doesNotMatch(op,/PAYROLL_RELEASE/);
  assert.match(ac,/PAYROLL_RELEASE/);assert.match(ac,/COMPANY_FINANCES_RECORD/);
  assert.doesNotMatch(ac,/ATTENDANCE_MANAGE/);
});
test('frontend route and sidebar require same finance view key',()=>{
  assert.match(read('../../client/src/App.jsx'),/path="company-finances" element=\{protect\(PERMISSIONS.COMPANY_FINANCES_VIEW/);
  assert.match(read('../../client/src/layout/SystemLayout.jsx'),/Company Finances".*COMPANY_FINANCES_VIEW/);
});
test('cash summary is below the date range filter and permission gated',()=>{
  const s=read('../../client/src/pages/System/Reports.jsx');
  assert.ok(s.indexOf('<DateRangeFilter')<s.indexOf('Company Cash Summary'));
  assert.match(s,/canViewCompanyFinances \?/);
});
test('owner permission list includes new finance controls',()=>{
  const s=read('../config/permissions.js');
  for(const key of ['COMPANY_FINANCES_VIEW','COMPANY_FINANCES_RECORD','COMPANY_FINANCES_EDIT','COMPANY_FINANCES_CATEGORIES','COMPANY_FINANCES_OPENING_BALANCE'])assert.ok(s.includes(key));
});
