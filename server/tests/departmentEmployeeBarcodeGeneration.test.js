import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_EMPLOYEE_DEPARTMENT_CODES,
  normalizeDepartmentConfigs,
  validateDepartmentConfigs,
} from '../controllers/System/Employees/departmentBarcode.shared.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('default department barcode prefixes include IT and Marketing', () => {
  assert.deepEqual(DEFAULT_EMPLOYEE_DEPARTMENT_CODES.find((item) => item.name === 'IT'), { name: 'IT', prefix: 'IT' });
  assert.deepEqual(DEFAULT_EMPLOYEE_DEPARTMENT_CODES.find((item) => item.name === 'Marketing'), { name: 'Marketing', prefix: 'MKT' });
});

test('legacy department names receive usable prefixes and configured prefixes must be unique', () => {
  const configs = normalizeDepartmentConfigs([], ['IT', 'Marketing', 'Human Resources']);
  assert.equal(configs.find((item) => item.name === 'IT')?.prefix, 'IT');
  assert.equal(configs.find((item) => item.name === 'Marketing')?.prefix, 'MKT');
  assert.equal(configs.find((item) => item.name === 'Human Resources')?.prefix, 'HR');
  assert.throws(() => validateDepartmentConfigs([
    { name: 'IT', prefix: 'IT' },
    { name: 'Internal Tools', prefix: 'IT' },
  ]), /already used/i);
});

test('employee creation previews then atomically allocates department barcode sequence', () => {
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js');
  const router = read('server/routers/System/employees.routers.js');
  const modal = read('client/src/components/System/employeeComponents/EmployeeModal.jsx');
  assert.match(router, /post\('\/barcode-preview'/);
  assert.match(controller, /employee_barcode_sequences/);
  assert.match(controller, /FOR UPDATE/);
  assert.match(controller, /Math\.max\(sequenceNumber, existingMax\) \+ 1/);
  assert.match(controller, /padStart\(3, '0'\)/);
  assert.match(controller, /MAX_DEPARTMENT_BARCODE_NUMBER = 999/);
  assert.match(modal, /Next: Generate Barcode/);
  assert.match(modal, /preview of the next available code/);
  assert.match(modal, /Save Employee/);
  assert.match(modal, /permanent attendance barcode/);
});

test('existing employee barcode is immutable while employee details remain editable', () => {
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js');
  const updateStart = controller.indexOf('export const updateEmployee =');
  const updateEnd = controller.indexOf('export const updateEmployeeStatus =');
  const updateBlock = controller.slice(updateStart, updateEnd);
  assert.doesNotMatch(updateBlock, /SET employee_code\s*=/);
  assert.match(updateBlock, /Existing barcode .* was preserved/);
});

test('system settings manage department names and barcode prefixes together', () => {
  const controller = read('server/controllers/System/systemSettings.controller.js');
  const form = read('client/src/components/System/settingsComponents/SystemSettingsForm.jsx');
  assert.match(controller, /employee_department_codes_json/);
  assert.match(controller, /validateDepartmentConfigs/);
  assert.match(form, /Department Barcode Prefixes/);
  assert.match(form, /Barcode Prefix/);
  assert.match(form, /Add Department/);
  assert.match(form, /IT → IT-001/);
});
