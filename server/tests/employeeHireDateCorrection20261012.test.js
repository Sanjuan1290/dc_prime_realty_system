import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { correctEmployeeHireDate, normalizeHireDate } from '../services/employeeHireDateCorrection.service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (source) => fs.readFileSync(path.join(root, source), 'utf8');
const params = {
  employeeId: 1, previousHireDate: '2026-10-12', newHireDate: '2026-10-01',
  reason: 'Corrected HR onboarding date', actorId: 7, today: '2026-10-12',
};

function db({ finalized = false, attendance = null, secondChange = null, draft = false, restDays = true } = {}) {
  const queries = [];
  const connection = {
    queries,
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('FROM employee_payrolls') && sql.includes("IN ('finalized'")) return [[...(finalized ? [{ payroll_status: 'finalized' }] : [])]];
      if (sql.includes('MIN(attendance_date)')) return [[{ first_attendance_date: attendance }]];
      if (sql.includes('FROM employee_employment_history') && sql.includes('ORDER BY')) return [[
        { employee_employment_history_id: 3, change_type: 'hired', effective_from: '2026-10-12', effective_to: secondChange ? '2026-10-14' : null },
        ...(secondChange ? [{ employee_employment_history_id: 4, change_type: 'salary_increase', effective_from: secondChange, effective_to: null }] : []),
      ]];
      if (sql.includes('FROM employee_rest_day_assignments')) return [[
        ...(restDays ? [{ employee_rest_day_id: 6, effective_from: '2026-10-12', effective_to: null }] : []),
      ]];
      if (sql.includes('FROM employee_payrolls') && sql.includes("= 'draft'")) return [[...(draft ? [{ employee_payroll_id: 8 }] : [])]];
      return [{ affectedRows: 1 }];
    },
  };
  return connection;
}

test('strict hire date validation rejects impossible dates and future hire dates', async () => {
  assert.equal(normalizeHireDate('2026-02-30'), null);
  assert.equal(normalizeHireDate('2026-10-01'), '2026-10-01');
  assert.equal(normalizeHireDate('2026-10-01T00:00:00'), null);
  await assert.rejects(correctEmployeeHireDate(db(), { ...params, newHireDate: '2026-10-15' }), /not in the future/);
});

test('backdated hire date corrects initial history and rest-day start with audit-friendly reason', async () => {
  const connection = db({ draft: true });
  const result = await correctEmployeeHireDate(connection, params);
  assert.deepEqual(result, { changed: true, previous: '2026-10-12', current: '2026-10-01', reason: params.reason, hasDraft: true });
  const restUpdate = connection.queries.find((q) => q.sql.includes('UPDATE employee_rest_day_assignments'));
  assert.deepEqual(restUpdate.values, ['2026-10-01', 7, 1, '2026-10-12']);
  const historyUpdate = connection.queries.find((q) => q.sql.includes('UPDATE employee_employment_history'));
  assert.equal(historyUpdate.values[0], '2026-10-01');
  assert.match(historyUpdate.values[2], /Corrected HR onboarding date/);
});

test('unchanged hire date is harmless and does not make SQL updates', async () => {
  const connection = db();
  const result = await correctEmployeeHireDate(connection, { ...params, newHireDate: '2026-10-12', reason: '' });
  assert.equal(result.changed, false);
  assert.equal(connection.queries.length, 0);
});

test('cannot change hire date when payroll was finalized or released', async () => {
  const connection = db({ finalized: true });
  await assert.rejects(correctEmployeeHireDate(connection, params), /finalized or released payroll/);
  assert.equal(connection.queries.some((q) => /^\s*UPDATE\b/i.test(q.sql)), false);
});

test('cannot set hire date after an existing attendance record', async () => {
  const connection = db({ attendance: '2026-10-04' });
  await assert.rejects(correctEmployeeHireDate(connection, { ...params, newHireDate: '2026-10-05' }), /first recorded attendance/);
  assert.equal(connection.queries.some((q) => /^\s*UPDATE\b/i.test(q.sql)), false);
});

test('cannot overlap a later salary or job change', async () => {
  const connection = db({ secondChange: '2026-10-15' });
  await assert.rejects(correctEmployeeHireDate(connection, { ...params, today: '2026-10-16', newHireDate: '2026-10-15' }), /earlier than the next recorded employment change/);
});

test('hire date corrections require a reason', async () => {
  await assert.rejects(correctEmployeeHireDate(db(), { ...params, reason: '' }), /short reason/);
});

test('edit modal includes usable Hire Date and condensed employee sections', () => {
  const modal = read('client/src/components/System/employeeComponents/EmployeeModal.jsx');
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js');
  assert.match(modal, /Hire Date \*/);
  assert.match(modal, /value=\{form\.hire_date\}/);
  assert.match(modal, /hire_date_change_reason/);
  assert.match(modal, /<details className="group/);
  assert.match(modal, /Current Job Details/);
  assert.match(controller, /correctEmployeeHireDate\(connection/);
  assert.match(controller, /hire_date = \?/);
  assert.match(controller, /payrollDraftRecalculationRequired/);
  assert.match(controller, /effectiveFrom: hireDate/);
});

