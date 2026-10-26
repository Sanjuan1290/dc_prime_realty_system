import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const detail = read('client/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx');
const page = read('client/src/pages/System/EmployeeSalary.jsx');
const history = read('client/src/components/System/employeeSalaryComponents/SalaryHistoryModal.jsx');

test('Salary Detail no longer exposes a Salary Correction button or shortcut', () => {
  assert.doesNotMatch(detail, /<button[^>]*>\s*(?:Create )?Salary Correction\s*<\/button>/);
  assert.doesNotMatch(detail, /Salary Correction<\/button>/);
  assert.doesNotMatch(detail, /setShowCorrection|showCorrection|<CorrectPayrollModal|import CorrectPayrollModal|canCorrect/);
});

test('Payroll and Salary History no longer pass correction-control props', () => {
  assert.doesNotMatch(page, /canCorrect|PAYROLL_CORRECT_FINALIZED/);
  assert.doesNotMatch(history, /canCorrect|CorrectPayrollModal/);
});

test('Normal payroll flow and historical audit remain available', () => {
  assert.match(detail, /Recalculate Draft/);
  assert.match(detail, /Proceed to Final Review/);
  assert.match(detail, /Mark as Released/);
  assert.match(detail, /Correction History/);
  assert.match(detail, /Attendance changed after this payroll was finalized/);
  assert.match(detail, /This finalized salary remains unchanged/);
  assert.match(page, /Salary History/);
});
