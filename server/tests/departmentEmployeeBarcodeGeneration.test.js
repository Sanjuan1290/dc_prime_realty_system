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
import {
  ATTENDANCE_BARCODE_LENGTH,
  buildAttendanceBarcode,
  generateAttendanceBarcodeCandidate,
  isValidAttendanceBarcode,
} from '../controllers/System/Employees/attendanceBarcode.shared.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('department prefixes still generate human Employee Codes such as IT-001', () => {
  assert.deepEqual(DEFAULT_EMPLOYEE_DEPARTMENT_CODES.find((item) => item.name === 'IT'), { name: 'IT', prefix: 'IT' });
  assert.deepEqual(DEFAULT_EMPLOYEE_DEPARTMENT_CODES.find((item) => item.name === 'Marketing'), { name: 'Marketing', prefix: 'MKT' });
  const configs = normalizeDepartmentConfigs([], ['IT', 'Marketing', 'Human Resources']);
  assert.equal(configs.find((item) => item.name === 'Human Resources')?.prefix, 'HR');
  assert.throws(() => validateDepartmentConfigs([{ name: 'IT', prefix: 'IT' }, { name: 'Internal Tools', prefix: 'IT' }]), /already used/i);
});

test('attendance barcodes are separate valid 10-digit values with a check digit', () => {
  assert.equal(ATTENDANCE_BARCODE_LENGTH, 10);
  const built = buildAttendanceBarcode('123456789');
  assert.equal(built.length, 10);
  assert.match(built, /^\d{10}$/);
  assert.equal(isValidAttendanceBarcode(built), true);
  assert.equal(isValidAttendanceBarcode(`${built.slice(0, 9)}${(Number(built[9]) + 1) % 10}`), false);
  for (let index = 0; index < 20; index += 1) {
    const candidate = generateAttendanceBarcodeCandidate();
    assert.match(candidate, /^\d{10}$/);
    assert.equal(isValidAttendanceBarcode(candidate), true);
  }
});

test('employee creation atomically allocates human code and separately creates secure attendance barcode', () => {
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js');
  const router = read('server/routers/System/employees.routers.js');
  const modal = read('client/src/components/System/employeeComponents/EmployeeModal.jsx');
  assert.match(router, /post\('\/employee-code-preview'/);
  assert.match(controller, /employee_barcode_sequences/);
  assert.match(controller, /FOR UPDATE/);
  assert.match(controller, /generateUniqueAttendanceBarcode/);
  assert.match(controller, /employee_code, barcode_code/);
  assert.match(modal, /Next: Generate Employee Code/);
  assert.match(modal, /separate random 10-digit Attendance Barcode/);
  assert.match(modal, /Attendance Barcode Ready/);
});

test('employee code and attendance barcode are preserved on ordinary employee edits', () => {
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js');
  const updateStart = controller.indexOf('export const updateEmployee =');
  const updateEnd = controller.indexOf('export const regenerateEmployeeAttendanceBarcode =');
  const updateBlock = controller.slice(updateStart, updateEnd);
  assert.doesNotMatch(updateBlock, /SET\s+employee_code\s*=/i);
  assert.doesNotMatch(updateBlock, /SET\s+barcode_code\s*=/i);
  assert.match(updateBlock, /attendance barcode were preserved/i);
});

test('attendance barcode regeneration changes only the scan identifier and keeps human employee code', () => {
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js');
  const router = read('server/routers/System/employees.routers.js');
  assert.match(router, /regenerate-barcode/);
  assert.match(controller, /Regenerated attendance barcode/);
  assert.match(controller, /employee code .* was preserved/i);
  assert.match(controller, /UPDATE employees SET barcode_code =/);
});

test('attendance scanners only accept the secure barcode_code, not IT-001 style employee codes', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js');
  assert.match(controller, /WHERE e\.barcode_code = \?/);
  assert.match(controller, /isValidAttendanceBarcode/);
  assert.doesNotMatch(controller, /req\.body\.employee_code/);
});

test('Attendance Settings owns department Employee Code prefixes', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSettings.controller.js');
  const modal = read('client/src/components/System/employeeComponents/AttendanceSettingsModal.jsx');
  const systemForm = read('client/src/components/System/settingsComponents/SystemSettingsForm.jsx');
  assert.match(controller, /employee_department_codes_json/);
  assert.match(controller, /validateDepartmentConfigs/);
  assert.match(modal, /Employee Departments & Codes/);
  assert.match(modal, /Employee Code Prefix/);
  assert.match(modal, /AddDepartmentModal/);
  assert.match(modal, /Department Name \*/);
  assert.match(modal, /Employee Code Prefix \*/);
  assert.match(modal, /already exists/);
  assert.match(modal, /already used by another department/);
  assert.match(modal, /item\._rowId/);
  assert.doesNotMatch(modal, /key=\{`\$\{item\.name/);
  assert.doesNotMatch(systemForm, /Employee Attendance/);
  assert.doesNotMatch(systemForm, /Department Barcode Prefixes/);
});
