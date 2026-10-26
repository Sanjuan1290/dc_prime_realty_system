import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizePayrollSettingsSnapshot, validatePayrollSettingsPayload } from '../services/payrollSettings.service.js';
const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
test('new policy defaults are ON with existing server-approved policies', () => {
  assert.equal(normalizePayrollSettingsSnapshot({}).new_hire_proration_rule, 'scheduled_workdays');
  assert.equal(normalizePayrollSettingsSnapshot({}).attendance_bonus_rule, 'perfect_attendance_per_period');
  assert.equal(validatePayrollSettingsPayload({}).new_hire_proration_rule, 'scheduled_workdays');
  assert.equal(validatePayrollSettingsPayload({}).attendance_bonus_rule, 'perfect_attendance_per_period');
});
test('explicit OFF values remain OFF and never become ON accidentally', () => {
  const settings = normalizePayrollSettingsSnapshot({new_hire_proration_rule:'disabled',attendance_bonus_rule:'disabled'});
  assert.equal(settings.new_hire_proration_rule, 'disabled');
  assert.equal(settings.attendance_bonus_rule, 'disabled');
  const saved = validatePayrollSettingsPayload({...settings});
  assert.equal(saved.new_hire_proration_rule, 'disabled');
  assert.equal(saved.attendance_bonus_rule, 'disabled');
});
test('frontend uses switches, not select menus, for both settings',()=>{
  const src = read('client/src/components/System/employeeSalaryComponents/PayrollSettingsModal.jsx');
  assert.match(src,/role="switch"/);
  assert.match(src,/aria-checked=\{checked\}/);
  assert.match(src,/enabled \? 'scheduled_workdays' : 'disabled'/);
  assert.match(src,/enabled \? 'perfect_attendance_per_period' : 'disabled'/);
  assert.doesNotMatch(src,/<select value=\{form\.new_hire_proration_rule\}/);
  assert.doesNotMatch(src,/<select value=\{form\.attendance_bonus_rule\}/);
});
test('migration preserves deliberately saved settings, leaves frozen payroll untouched',()=>{
  const sql=read('server/migrations/20261026_payroll_simple_toggles_default_on.sql');
  assert.match(sql,/updated_by_user_id IS NULL/);
  assert.match(sql,/DEFAULT 'scheduled_workdays'/);
  assert.match(sql,/DEFAULT 'perfect_attendance_per_period'/);
  assert.doesNotMatch(sql,/\b(?:DELETE|DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(sql,/UPDATE employee_payrolls/i);
});
test('holiday overtime multipliers remain independent and nullable',()=>{
  const s = normalizePayrollSettingsSnapshot({regular_holiday_multiplier:1,special_holiday_multiplier:1});
  assert.equal(s.regular_holiday_multiplier,1);
  assert.equal(s.special_holiday_multiplier,1);
  assert.equal(s.regular_holiday_ot_multiplier,null);
  assert.equal(s.special_holiday_ot_multiplier,null);
});
